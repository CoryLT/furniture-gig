import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  handleAccountUpdated,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handlePaymentIntentCanceled,
  handleTransferCreated,
  handleTransferReversed,
  handleChargeRefunded,
  handleChargeDisputeCreated,
} from '@/lib/stripe-webhook-handlers'

/**
 * Stripe webhook receiver.
 *
 * Stripe POSTs here whenever something happens we asked to be notified about.
 *
 * Flow:
 *   1. Read the raw body (required for signature verification — DO NOT parse
 *      JSON first; the signature is computed over the raw bytes).
 *   2. Verify the Stripe signature header against STRIPE_WEBHOOK_SECRET. If
 *      this fails, the request is either tampered with or not from Stripe,
 *      and we reject with 400.
 *   3. Insert the event into stripe_webhook_events using the event ID as the
 *      primary key. If the row already exists (duplicate delivery), we
 *      short-circuit and return 200 — telling Stripe "we already got this."
 *   4. Dispatch to the appropriate handler based on event.type. Unknown
 *      types get logged as 'ignored'.
 *   5. Mark the event row 'processed' (or 'error' with a message).
 *   6. Always return 200 unless step 1 or 2 failed. If a handler throws, we
 *      still return 200 — the error is stored on the event row — because
 *      returning 500 makes Stripe retry, and retries can amplify a bug
 *      (e.g. infinite-looping if our handler has a deterministic crash).
 *      Admins can replay events from the Stripe dashboard if needed.
 */

// Required: don't let Next try to parse the body. We need the raw bytes.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // --- 0. Env check ---
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook not configured.' },
      { status: 500 }
    )
  }

  // --- 1. Get raw body + signature ---
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 }
    )
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Could not read request body.', detail: err?.message },
      { status: 400 }
    )
  }

  // --- 2. Verify signature ---
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    // Bad signature → almost certainly not actually from Stripe.
    console.error('[stripe webhook] signature verification failed:', err?.message)
    return NextResponse.json(
      { error: `Signature verification failed: ${err?.message}` },
      { status: 400 }
    )
  }

  // --- 3. Idempotency: insert event row, bail if duplicate ---
  const supabase = createAdminClient()

  const { error: insertErr } = await supabase
    .from('stripe_webhook_events')
    .insert({
      id: event.id,
      type: event.type,
      api_version: event.api_version ?? null,
      stripe_created_at: new Date(event.created * 1000).toISOString(),
      payload: event as any,
      status: 'received',
    })

  if (insertErr) {
    // PG unique-violation code is '23505'. Duplicate delivery → already handled.
    if ((insertErr as any).code === '23505') {
      return NextResponse.json({ status: 'ok', duplicate: true })
    }
    // Any other insert error is unexpected. Don't process; ask Stripe to retry.
    console.error('[stripe webhook] event insert failed:', insertErr.message)
    return NextResponse.json(
      { error: 'Event log insert failed.', detail: insertErr.message },
      { status: 500 }
    )
  }

  // --- 4. Dispatch ---
  let handlerMessage = ''
  let handlerStatus: 'processed' | 'ignored' | 'error' = 'ignored'
  let handlerError: string | null = null

  try {
    // Cast: Stripe's TS literal union doesn't include some valid runtime
    // event types (e.g. 'transfer.failed'). The SDK delivers them fine;
    // it's just the type narrowing that's incomplete.
    switch (event.type as string) {
      case 'account.updated':
        handlerMessage = await handleAccountUpdated(event, supabase)
        handlerStatus = 'processed'
        break

      case 'payment_intent.succeeded':
        handlerMessage = await handlePaymentIntentSucceeded(event, supabase)
        handlerStatus = 'processed'
        break

      case 'payment_intent.payment_failed':
        handlerMessage = await handlePaymentIntentFailed(event, supabase)
        handlerStatus = 'processed'
        break

      case 'payment_intent.canceled':
        handlerMessage = await handlePaymentIntentCanceled(event, supabase)
        handlerStatus = 'processed'
        break

      case 'transfer.created':
        handlerMessage = await handleTransferCreated(event, supabase)
        handlerStatus = 'processed'
        break

      case 'transfer.reversed':
        handlerMessage = await handleTransferReversed(event, supabase)
        handlerStatus = 'processed'
        break

      case 'charge.refunded':
        handlerMessage = await handleChargeRefunded(event, supabase)
        handlerStatus = 'processed'
        break

      case 'charge.dispute.created':
        handlerMessage = await handleChargeDisputeCreated(event, supabase)
        handlerStatus = 'processed'
        break

      default:
        handlerMessage = `unhandled event type: ${event.type}`
        handlerStatus = 'ignored'
    }
  } catch (err: any) {
    handlerStatus = 'error'
    handlerError = err?.message ?? String(err)
    console.error(
      `[stripe webhook] handler error for ${event.type} (${event.id}):`,
      handlerError
    )
  }

  // --- 5. Mark the event row with outcome ---
  await supabase
    .from('stripe_webhook_events')
    .update({
      status: handlerStatus,
      processed_at: new Date().toISOString(),
      error_message: handlerError,
      // Stuff the handler's message into error_message when it's not an error
      // — gives admins one place to read what happened. Bit of a hack; if we
      // care later, add a `notes` column.
      ...(handlerError ? {} : { error_message: handlerMessage }),
    })
    .eq('id', event.id)

  // --- 6. Always 200 if we got this far ---
  // See header comment for why we don't 500 on handler errors.
  return NextResponse.json({
    status: 'ok',
    eventId: event.id,
    type: event.type,
    handlerStatus,
    handlerMessage: handlerError ?? handlerMessage,
  })
}
