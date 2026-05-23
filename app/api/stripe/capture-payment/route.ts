import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { capturePickPayment } from '@/lib/stripe-capture'

/**
 * POST /api/stripe/capture-payment
 *
 * Stripe Connect Phase 4 — capture on approval.
 *
 * Called by the admin review page when the admin approves submitted work.
 *
 * Body: { claimId: string }
 *
 * What this does, in order:
 *   1. Verify caller is logged in and is an admin.
 *   2. Load the claim → find the matching payout_records row.
 *   3. If the payout row has a stripe_payment_intent_id, call
 *      stripe.paymentIntents.capture() on it. Stripe will auto-transfer
 *      (gig amount − platform fee) to the worker's Connect account.
 *   4. Update the payout row: payment_status='captured', and the legacy
 *      payout_status='paid' so existing UIs reflect the new reality.
 *   5. If there's NO Stripe PaymentIntent (legacy / pre-Stripe gig),
 *      treat it as a no-op success — the caller (ReviewActions) will
 *      handle the claim/gig status updates either way.
 *
 * Returns:
 *   { status: 'ok', captured: boolean }     → all good
 *   { error: '...' }                         → something went wrong
 *
 * 'captured: true' means Stripe actually moved money. 'captured: false'
 * means there was no Stripe PaymentIntent for this gig (legacy manual
 * payout) — the route still returns ok so the rest of the approve flow
 * can proceed.
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

  if (!process.env.STRIPE_SECRET_KEY) {
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

  // --- 3. Load claim ---
  const { data: claim, error: claimErr } = await supabase
    .from('gig_claims')
    .select('id, gig_id, worker_user_id, status')
    .eq('id', claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return NextResponse.json(
      { error: 'Claim not found.', detail: claimErr?.message },
      { status: 404 }
    )
  }

  // --- 3a. Authorization check: caller must be the gig's poster OR admin ---
  // Load the gig to find the poster. coalesce(poster_user_id, created_by)
  // is the standard pattern for this codebase.
  const { data: gigRow, error: gigErr } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by')
    .eq('id', claim.gig_id)
    .maybeSingle()

  if (gigErr || !gigRow) {
    return NextResponse.json(
      { error: 'Gig not found.', detail: gigErr?.message },
      { status: 404 }
    )
  }

  const posterId =
    (gigRow as any).poster_user_id ?? (gigRow as any).created_by

  if (user.id !== posterId) {
    // Not the poster — allow admin as a fallback for support.
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if ((userRow as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'You are not the poster of this gig.' },
        { status: 403 }
      )
    }
  }

  // --- 4. Look up the matching payout_records row ---
  // The Phase 3 pick-worker route inserts one row per (gig, worker) at
  // pick time. Look for the most recent one in 'authorized' status.
  const { data: payoutRow, error: payoutErr } = await (supabase as any)
    .from('payout_records')
    .select(
      'id, stripe_payment_intent_id, payment_status, payout_status'
    )
    .eq('gig_id', claim.gig_id)
    .eq('worker_user_id', claim.worker_user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (payoutErr) {
    return NextResponse.json(
      { error: 'Could not load payout record.', detail: payoutErr.message },
      { status: 500 }
    )
  }

  // No payout row at all → legacy/manual gig. Approve flow can proceed
  // without a Stripe capture; the caller will handle creating a manual
  // payout record if it wants.
  if (!payoutRow) {
    return NextResponse.json({ status: 'ok', captured: false })
  }

  const paymentIntentId = (payoutRow as any)
    .stripe_payment_intent_id as string | null
  const currentPaymentStatus = (payoutRow as any).payment_status as string

  // If the payment was already captured (e.g. retry after a network
  // blip), short-circuit to ok. Idempotent behavior.
  if (currentPaymentStatus === 'captured' || currentPaymentStatus === 'transferred') {
    return NextResponse.json({ status: 'ok', captured: true, alreadyCaptured: true })
  }

  // If there's no Stripe PI on this row, it's a legacy/manual record.
  // No Stripe action needed; just flip the legacy status so admin UIs
  // reflect "paid".
  if (!paymentIntentId) {
    await (supabase as any)
      .from('payout_records')
      .update({ payout_status: 'paid', payout_date: new Date().toISOString() })
      .eq('id', (payoutRow as any).id)

    return NextResponse.json({ status: 'ok', captured: false })
  }

  // Defensive: only capture if the row is in 'authorized'. Any other
  // Stripe-status row (failed, canceled, refunded, etc.) is not safe
  // to capture and likely indicates we got here in error.
  if (currentPaymentStatus !== 'authorized') {
    return NextResponse.json(
      {
        error: `Payment is not in an authorized state (current: ${currentPaymentStatus}). Cannot capture.`,
      },
      { status: 409 }
    )
  }

  // --- 5. Call Stripe to capture ---
  const result = await capturePickPayment(paymentIntentId)

  if (result.status === 'failed') {
    // Capture failed. Don't change the DB — the hold is still in place,
    // admin can retry. Surface the message for visibility.
    return NextResponse.json(
      {
        error: result.message || 'Stripe capture failed.',
      },
      { status: 502 }
    )
  }

  // --- 6. Update the payout row ---
  const captureChargeId =
    typeof result.paymentIntent.latest_charge === 'string'
      ? result.paymentIntent.latest_charge
      : result.paymentIntent.latest_charge?.id ?? null

  const { error: updateErr } = await (supabase as any)
    .from('payout_records')
    .update({
      payment_status: 'captured',
      stripe_charge_id: captureChargeId,
      // Legacy column kept in sync so existing admin payouts UI flips
      // this row into the "paid" bucket.
      payout_status: 'paid',
      payout_date: new Date().toISOString(),
      notes: 'Captured via Stripe (Phase 4 capture-on-approval)',
    })
    .eq('id', (payoutRow as any).id)

  if (updateErr) {
    // Money is captured on Stripe's side but DB write failed. This is
    // a "stuck" state — surface a clear error so admin knows to check
    // the Stripe dashboard. The capture itself is fine; the row will
    // get reconciled when webhooks land in Phase 7.
    return NextResponse.json(
      {
        error:
          'Payment captured on Stripe but the payout record could not be updated. Check Stripe dashboard for payment ID ' +
          paymentIntentId,
        detail: updateErr.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    captured: true,
    paymentIntentId,
    chargeId: captureChargeId,
  })
}
