import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cancelPickAuthorization } from '@/lib/stripe-pick'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/stripe/cancel-pick
 *
 * No-show handling. The gig poster (or admin) cancels the worker they
 * picked. In order:
 *   1. Verify caller is the gig poster (or admin).
 *   2. Verify the claim is 'active' (a currently picked worker).
 *   3. Refuse if the payment was already captured (worker was paid) —
 *      that needs a refund, not a cancel.
 *   4. Release the Stripe hold so the flipper is charged nothing.
 *   5. Void the payout record, cancel the claim, reopen the gig.
 *
 * Body: { claimId: string }
 */
export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

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

  // Load the claim.
  const { data: claim, error: claimErr } = await supabase
    .from('gig_claims')
    .select('id, gig_id, worker_user_id, status')
    .eq('id', claimId)
    .maybeSingle()
  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 })
  }

  if (claim.status !== 'active') {
    return NextResponse.json(
      {
        error: `Only a picked worker can be cancelled here (current status: ${claim.status}).`,
      },
      { status: 409 }
    )
  }

  // Load the gig + verify caller is the poster or an admin.
  const { data: gig, error: gigErr } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by, status')
    .eq('id', claim.gig_id)
    .maybeSingle()
  if (gigErr || !gig) {
    return NextResponse.json({ error: 'Gig not found.' }, { status: 404 })
  }

  const posterId = (gig as any).poster_user_id ?? (gig as any).created_by
  let isAdmin = false
  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  isAdmin = (me as any)?.role === 'admin'

  if (user.id !== posterId && !isAdmin) {
    return NextResponse.json(
      { error: 'Only the gig poster can cancel this worker.' },
      { status: 403 }
    )
  }

  // Auth checks passed — use the admin client for the writes (bypasses RLS).
  const admin = createAdminClient()

  // Find the most recent payout record holding this gig+worker payment.
  const { data: payout } = await admin
    .from('payout_records')
    .select('id, stripe_payment_intent_id, payment_status')
    .eq('gig_id', claim.gig_id)
    .eq('worker_user_id', claim.worker_user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const paymentStatus = (payout as any)?.payment_status as string | undefined

  // Safety: never silently reverse money that already moved.
  if (paymentStatus === 'captured' || paymentStatus === 'transferred') {
    return NextResponse.json(
      {
        error:
          'This payment was already captured (the worker was paid). Cancel is only for no-shows before payment — handle this as a refund instead.',
      },
      { status: 409 }
    )
  }

  // Release the Stripe authorization hold if one is still live.
  const paymentIntentId = (payout as any)?.stripe_payment_intent_id as
    | string
    | undefined
  if (paymentIntentId && paymentStatus === 'authorized') {
    try {
      await cancelPickAuthorization(paymentIntentId)
    } catch (err: any) {
      const msg = err?.message || ''
      // If Stripe says it's already canceled/expired, treat as success.
      const benign = /already|cancel|no longer|expired|succeeded/i.test(msg)
      if (!benign) {
        return NextResponse.json(
          { error: `Could not release the payment hold: ${msg}` },
          { status: 502 }
        )
      }
    }
  }

  // Void the payout record (payout_status stays a legal value: 'unpaid').
  if ((payout as any)?.id) {
    await admin
      .from('payout_records')
      .update({
        payment_status: 'canceled',
        payout_status: 'unpaid',
        notes: 'No-show — gig cancelled and payment hold released.',
      })
      .eq('id', (payout as any).id)
  }

  // Cancel the claim.
  const { error: claimUpdErr } = await admin
    .from('gig_claims')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', claim.id)
  if (claimUpdErr) {
    return NextResponse.json(
      { error: `Could not cancel the claim: ${claimUpdErr.message}` },
      { status: 500 }
    )
  }

  // Reopen the gig.
  const { error: gigUpdErr } = await admin
    .from('gigs')
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', claim.gig_id)
  if (gigUpdErr) {
    return NextResponse.json(
      {
        error: `The worker was cancelled but the gig could not be reopened: ${gigUpdErr.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'ok' })
}
