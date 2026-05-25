import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  authorizePickPayment,
  cancelPickAuthorization,
} from '@/lib/stripe-pick'

export const dynamic = 'force-dynamic'
export const revalidate = 0
/**
 * POST /api/stripe/pick-worker
 *
 * Stripe Connect Phase 3 — authorize on pick.
 *
 * Body: { claimId: string }
 *
 * What this does, in order:
 *   1. Verify caller is logged in and is the gig's poster.
 *   2. Verify the claim is still 'pending' (not already picked or rejected).
 *   3. Verify the worker has Stripe Connect set up and charges_enabled.
 *   4. Verify the flipper has a Stripe Customer + saved card.
 *   5. Create a PaymentIntent that HOLDS the gig amount (manual capture).
 *   6. Insert a payout_records row in 'authorized' status.
 *   7. Call approve_applicant RPC — that worker wins, others get rejected.
 *   8. If approve fails AFTER hold succeeded, release the hold cleanly.
 *
 * Returns:
 *   { status: 'ok' }                            → all good, picked
 *   { status: 'requires_action', clientSecret } → 3D Secure needed
 *   { error: '...' }                            → something went wrong
 */
export async function POST(req: Request) {
  const supabase = createClient()

  // --- 1. Auth ---
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY_LIVE) {
    return NextResponse.json(
      { error: 'Stripe is not configured.' },
      { status: 500 }
    )
  }

  // --- 2. Parse body ---
  let claimId: string
  try {
    const body = await req.json()
    claimId = body?.claimId
    if (!claimId || typeof claimId !== 'string') {
      return NextResponse.json({ error: 'Missing claimId.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // --- 3. Load claim + gig + worker stripe info in one go ---
  // We do NOT use Supabase embed-joins here because RLS can silently null
  // out joined rows (see HANDOFF "Watch out for"). Use separate queries.

  // Load the claim
  const { data: claim, error: claimErr } = await supabase
    .from('gig_claims')
    .select('id, gig_id, worker_user_id, status')
    .eq('id', claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return NextResponse.json(
      { error: 'Application not found.', detail: claimErr?.message },
      { status: 404 }
    )
  }

  if (claim.status !== 'pending') {
    return NextResponse.json(
      {
        error:
          claim.status === 'active'
            ? 'This applicant has already been picked.'
            : `This application is not pending (status: ${claim.status}).`,
      },
      { status: 409 }
    )
  }

  // Load the gig — we need pay_amount + poster check
  const { data: gig, error: gigErr } = await supabase
    .from('gigs')
    .select('id, pay_amount, poster_user_id, created_by, status, title')
    .eq('id', claim.gig_id)
    .maybeSingle()

  if (gigErr || !gig) {
    return NextResponse.json(
      { error: 'Gig not found.', detail: gigErr?.message },
      { status: 404 }
    )
  }

  // Caller must be the poster (or admin — we check admin role for support)
  const posterId = (gig as any).poster_user_id ?? (gig as any).created_by
  let isAdmin = false
  if (user.id !== posterId) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = (userRow as any)?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'You are not the poster of this gig.' },
        { status: 403 }
      )
    }
  }

  // The flipper whose card we'll charge is always the poster, even if
  // an admin is initiating on their behalf.
  const flipperUserId = posterId as string

  // Load the flipper's Stripe Customer ID
  const { data: flipperUserRow, error: flipperUserErr } = await supabase
    .from('users')
    .select('id, stripe_customer_id' as any)
    .eq('id', flipperUserId)
    .maybeSingle()

  if (flipperUserErr || !flipperUserRow) {
    return NextResponse.json(
      { error: 'Could not load flipper account.' },
      { status: 500 }
    )
  }

  const customerId = (flipperUserRow as any).stripe_customer_id as string | null
  if (!customerId) {
    return NextResponse.json(
      {
        error:
          'No saved payment method on file. Please add a card before picking a worker.',
      },
      { status: 400 }
    )
  }

  // Load the worker's Stripe Connect account info
  const { data: workerProfile, error: workerErr } = await supabase
    .from('worker_profiles')
    .select(
      'user_id, stripe_account_id, stripe_charges_enabled' as any
    )
    .eq('user_id', claim.worker_user_id)
    .maybeSingle()

  if (workerErr || !workerProfile) {
    return NextResponse.json(
      { error: "Could not load this worker's profile." },
      { status: 500 }
    )
  }

  const workerStripeAccountId = (workerProfile as any)
    .stripe_account_id as string | null
  const workerChargesEnabled = Boolean(
    (workerProfile as any).stripe_charges_enabled
  )

  if (!workerStripeAccountId || !workerChargesEnabled) {
    return NextResponse.json(
      {
        error:
          "This worker's payment account isn't fully set up. They need to finish Stripe onboarding before you can pick them.",
      },
      { status: 400 }
    )
  }

  // --- 4. Validate gig amount ---
  const payAmount = Number((gig as any).pay_amount)
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return NextResponse.json(
      { error: 'Gig has an invalid pay amount.' },
      { status: 400 }
    )
  }

  // --- 5. Authorize the payment (hold money, don't capture yet) ---
  const result = await authorizePickPayment({
    customerId,
    workerStripeAccountId,
    gigAmountDollars: payAmount,
    gigId: gig.id,
    claimId: claim.id,
  })

  if (result.status === 'failed') {
    return NextResponse.json(
      { error: result.message || 'Payment authorization failed.' },
      { status: 402 }
    )
  }

  if (result.status === 'requires_action') {
    // 3D Secure needed. Frontend will run stripe.confirmCardPayment with
    // the client_secret, then re-call this endpoint (or a follow-up one).
    // We do NOT create the payout_records row yet — we wait for confirmation.
    return NextResponse.json({
      status: 'requires_action',
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntent.id,
    })
  }

  // result.status === 'ok' — money is authorized & held
  const { paymentIntent, breakdown } = result

  // --- 6. Insert payout_records row ---
  // We use `as any` because types/database.ts is out of sync with Stripe
  // columns (called out in HANDOFF TODO #8).
  const { error: payoutErr } = await (supabase as any)
    .from('payout_records')
    .insert({
      gig_id: gig.id,
      worker_user_id: claim.worker_user_id,
      flipper_user_id: flipperUserId,
      amount: breakdown.workerReceivesDollars,
      gross_amount: breakdown.grossDollars,
      stripe_fee_amount: breakdown.stripeFeeDollars,
      platform_fee_amount: breakdown.platformFeeDollars,
      stripe_payment_intent_id: paymentIntent.id,
      payment_status: 'authorized',
      // Legacy columns: keep something sensible so old UIs don't crash
      payout_status: 'pending',
      payout_reference: '',
      notes: 'Authorized via Stripe (Phase 3 authorize-on-pick)',
    })

  if (payoutErr) {
    // Roll back the Stripe hold so flipper isn't on the hook for nothing.
    await cancelPickAuthorization(paymentIntent.id)
    return NextResponse.json(
      {
        error: 'Could not save payment record. Authorization was released.',
        detail: payoutErr.message,
      },
      { status: 500 }
    )
  }

  // --- 7. Approve the applicant in the DB ---
  const { error: rpcErr } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: { message?: string } | null }>)('approve_applicant', {
    p_claim_id: claim.id,
  })

  if (rpcErr) {
    // Approve failed AFTER we held the money. Two cleanups:
    //  (a) Release the Stripe hold so flipper isn't charged.
    //  (b) Mark the payout_records row as canceled for audit.
    await cancelPickAuthorization(paymentIntent.id)
    await (supabase as any)
      .from('payout_records')
      .update({
        payment_status: 'canceled',
        notes: `Approve failed after authorization: ${rpcErr.message || 'unknown error'}`,
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    return NextResponse.json(
      {
        error:
          'Payment was held but the pick could not be completed. The hold has been released.',
        detail: rpcErr.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    paymentIntentId: paymentIntent.id,
    breakdown: {
      gigAmount: breakdown.gigAmountCents / 100,
      flipperPays: breakdown.grossDollars,
      workerReceives: breakdown.workerReceivesDollars,
      platformFee: breakdown.platformFeeDollars,
      stripeFee: breakdown.stripeFeeDollars,
    },
  })
}
