/**
 * Stripe webhook event handlers.
 *
 * Each handler takes a Stripe event and a Supabase admin client (service
 * role — bypasses RLS) and performs whatever DB updates are needed.
 *
 * Every handler is IDEMPOTENT — if it runs twice for the same event,
 * the second run is a no-op. We rely on:
 *   1) The route-level idempotency check (event ID is the PK of
 *      stripe_webhook_events), which short-circuits before we even
 *      get here on a duplicate.
 *   2) Conditional updates inside each handler (don't move a row
 *      backward in its status lifecycle).
 *
 * All handlers return a short human-readable string describing what
 * they did, which gets logged on the event row.
 */

import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// account.updated
// Worker's Connect account changed status (e.g. completed onboarding,
// got restricted, payouts disabled). Sync the latest flags into
// worker_profiles.
// ============================================================
export async function handleAccountUpdated(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const account = event.data.object as Stripe.Account

  // Find the worker_profile pointing at this account ID.
  const { data: worker, error: lookupErr } = await supabase
    .from('worker_profiles')
    .select('user_id')
    .eq('stripe_account_id', account.id)
    .maybeSingle()

  if (lookupErr) {
    throw new Error(`worker lookup failed: ${lookupErr.message}`)
  }

  if (!worker) {
    return `no worker_profile matched account ${account.id}; ignored`
  }

  const chargesEnabled = account.charges_enabled === true
  const payoutsEnabled = account.payouts_enabled === true
  const detailsSubmitted = account.details_submitted === true

  // First time everything's green → stamp the completion time.
  // Don't overwrite it if it's already set.
  const update: Record<string, any> = {
    stripe_charges_enabled: chargesEnabled,
    stripe_payouts_enabled: payoutsEnabled,
    stripe_details_submitted: detailsSubmitted,
  }

  if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
    // Only set the timestamp if it's currently null.
    const { data: cur } = await supabase
      .from('worker_profiles')
      .select('stripe_onboarding_completed_at')
      .eq('user_id', (worker as any).user_id)
      .maybeSingle()

    if (!((cur as any)?.stripe_onboarding_completed_at)) {
      update.stripe_onboarding_completed_at = new Date().toISOString()
    }
  }

  const { error: updErr } = await supabase
    .from('worker_profiles')
    .update(update)
    .eq('user_id', (worker as any).user_id)

  if (updErr) throw new Error(`worker update failed: ${updErr.message}`)

  return `synced account ${account.id}: charges=${chargesEnabled} payouts=${payoutsEnabled} details=${detailsSubmitted}`
}

// ============================================================
// payment_intent.succeeded
// Money was captured from the flipper. Update payout_records.
// In our flow, capture is initiated by /api/stripe/capture-payment, which
// also writes captured/paid to the DB synchronously. This webhook is the
// belt-and-suspenders backup — if the sync write failed (e.g. DB hiccup
// right after Stripe captured), this catches it up.
// ============================================================
export async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const pi = event.data.object as Stripe.PaymentIntent

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, payment_status, payout_status')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for PI ${pi.id}; ignored`

  const currentStatus = (row as any).payment_status as string

  // Don't move forward from 'transferred' (which is downstream) or
  // backward from a terminal state.
  if (currentStatus === 'transferred' || currentStatus === 'refunded') {
    return `payout already ${currentStatus}; no change`
  }

  const chargeId =
    typeof pi.latest_charge === 'string'
      ? pi.latest_charge
      : pi.latest_charge?.id ?? null

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({
      payment_status: 'captured',
      stripe_charge_id: chargeId,
      payout_status: 'paid',
      payout_date: new Date().toISOString(),
    })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `marked payout captured for PI ${pi.id}`
}

// ============================================================
// payment_intent.payment_failed
// Capture failed (e.g. card declined). Flip the payout row to failed.
// Worker did NOT get paid. Flipper should be alerted (future: email).
// ============================================================
export async function handlePaymentIntentFailed(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const pi = event.data.object as Stripe.PaymentIntent

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, payment_status')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for PI ${pi.id}; ignored`

  const failureReason =
    pi.last_payment_error?.message || 'Stripe reported payment_failed'

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({
      payment_status: 'failed',
      notes: `Payment failed: ${failureReason}`,
    })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `marked payout failed for PI ${pi.id}: ${failureReason}`
}

// ============================================================
// payment_intent.canceled
// Authorization was canceled before capture (e.g. flipper backed out,
// or it expired after 7 days). Flip the row to canceled.
// ============================================================
export async function handlePaymentIntentCanceled(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const pi = event.data.object as Stripe.PaymentIntent

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, payment_status')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for PI ${pi.id}; ignored`

  // Don't roll a captured/transferred/refunded row back to canceled.
  const currentStatus = (row as any).payment_status as string
  if (['captured', 'transferred', 'refunded'].includes(currentStatus)) {
    return `payout already ${currentStatus}; not canceling`
  }

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({
      payment_status: 'canceled',
      notes: `Authorization canceled (reason: ${pi.cancellation_reason ?? 'unknown'})`,
    })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `marked payout canceled for PI ${pi.id}`
}

// ============================================================
// transfer.created
// Money was successfully sent to a worker's Connect account.
// Stripe creates the transfer automatically on capture (because we
// set transfer_data.destination on the PI). Mark the row 'transferred'.
// ============================================================
export async function handleTransferCreated(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const transfer = event.data.object as Stripe.Transfer

  // The source_transaction (a charge id) is our link back to a PI/row.
  const sourceCharge =
    typeof transfer.source_transaction === 'string'
      ? transfer.source_transaction
      : transfer.source_transaction?.id ?? null

  if (!sourceCharge) {
    return `transfer ${transfer.id} has no source_transaction; ignored`
  }

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, payment_status')
    .eq('stripe_charge_id', sourceCharge)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for charge ${sourceCharge}; ignored`

  // Don't move backward from refunded.
  const currentStatus = (row as any).payment_status as string
  if (currentStatus === 'refunded') {
    return `payout already refunded; not marking transferred`
  }

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({
      payment_status: 'transferred',
      stripe_transfer_id: transfer.id,
    })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `marked payout transferred for charge ${sourceCharge}`
}

// ============================================================
// transfer.failed
// Transfer to worker failed (bank rejection, account restricted, etc.).
// Money is still on the platform; needs manual intervention.
// ============================================================
export async function handleTransferFailed(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const transfer = event.data.object as Stripe.Transfer

  const sourceCharge =
    typeof transfer.source_transaction === 'string'
      ? transfer.source_transaction
      : transfer.source_transaction?.id ?? null

  if (!sourceCharge) {
    return `transfer ${transfer.id} has no source_transaction; ignored`
  }

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, notes')
    .eq('stripe_charge_id', sourceCharge)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for charge ${sourceCharge}; ignored`

  const existingNotes = (row as any).notes ?? ''
  const failureNote = `Transfer failed (id ${transfer.id}); manual review needed.`
  const newNotes = existingNotes
    ? `${existingNotes}\n${failureNote}`
    : failureNote

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({
      payment_status: 'failed',
      stripe_transfer_id: transfer.id,
      notes: newNotes,
    })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `marked payout failed (transfer failed) for charge ${sourceCharge}`
}

// ============================================================
// charge.refunded
// Charge was refunded (full or partial). Flip the row to refunded.
// ============================================================
export async function handleChargeRefunded(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const charge = event.data.object as Stripe.Charge

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, notes')
    .eq('stripe_charge_id', charge.id)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for charge ${charge.id}; ignored`

  const refundedAmount = (charge.amount_refunded ?? 0) / 100
  const refundNote = `Refunded $${refundedAmount.toFixed(2)} at ${new Date().toISOString()}`

  const existingNotes = (row as any).notes ?? ''
  const newNotes = existingNotes
    ? `${existingNotes}\n${refundNote}`
    : refundNote

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({
      payment_status: 'refunded',
      payout_status: 'unpaid',
      notes: newNotes,
    })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `marked payout refunded for charge ${charge.id} ($${refundedAmount})`
}

// ============================================================
// charge.dispute.created
// Flipper disputed the charge with their bank. This is a chargeback.
// Don't change the row's status, but add a loud note so admin sees it.
// (A dispute can be won/lost later; full handling is a future Phase 8 task.)
// ============================================================
export async function handleChargeDisputeCreated(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string> {
  const dispute = event.data.object as Stripe.Dispute

  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id

  if (!chargeId) return `dispute ${dispute.id} has no charge id; ignored`

  const { data: row, error: lookupErr } = await supabase
    .from('payout_records')
    .select('id, notes')
    .eq('stripe_charge_id', chargeId)
    .maybeSingle()

  if (lookupErr) throw new Error(`payout lookup failed: ${lookupErr.message}`)
  if (!row) return `no payout_records row for charge ${chargeId}; ignored`

  const disputeNote = `⚠️ DISPUTE OPENED — reason: ${dispute.reason}, amount: $${(dispute.amount / 100).toFixed(2)}, dispute id: ${dispute.id}`
  const existingNotes = (row as any).notes ?? ''
  const newNotes = existingNotes
    ? `${existingNotes}\n${disputeNote}`
    : disputeNote

  const { error: updErr } = await supabase
    .from('payout_records')
    .update({ notes: newNotes })
    .eq('id', (row as any).id)

  if (updErr) throw new Error(`payout update failed: ${updErr.message}`)

  return `logged dispute on charge ${chargeId}`
}
