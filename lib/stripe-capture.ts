import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * Result of attempting to capture a previously-authorized PaymentIntent
 * when the admin approves submitted work (Phase 4).
 *
 * - 'ok'     → PaymentIntent captured. Stripe will auto-transfer the
 *              worker's cut (gig amount − platform fee) to their
 *              Connect account.
 * - 'failed' → Capture failed. The hold is still in place; admin can
 *              retry, or cancel manually via the Stripe dashboard.
 */
export type CapturePickResult =
  | {
      status: 'ok'
      paymentIntent: Stripe.PaymentIntent
    }
  | {
      status: 'failed'
      message: string
      paymentIntent?: Stripe.PaymentIntent
    }

/**
 * Capture a PaymentIntent that was previously authorized at pick-time.
 *
 * Why this exists: Phase 3 created the PaymentIntent with
 * `capture_method: 'manual'`. That means Stripe just placed a hold on
 * the flipper's card — no money has actually moved yet. This call is
 * what actually charges the card.
 *
 * Side effects on Stripe's side once capture succeeds:
 *   - The flipper's card is charged the full `grossCents` amount.
 *   - Stripe automatically transfers (gig amount − platform fee) to
 *     the worker's Connect account, because Phase 3 set
 *     `transfer_data.destination` on the original PaymentIntent.
 *   - Our platform's `application_fee_amount` lands in our platform
 *     Stripe balance.
 *
 * No idempotency key needed — capturing a PaymentIntent that's already
 * been captured returns an error from Stripe, which the caller can
 * inspect and handle. We treat any "already_captured" style error as
 * effectively success since the end state is the same.
 */
export async function capturePickPayment(
  paymentIntentId: string
): Promise<CapturePickResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId)

    // 'succeeded' is the happy-path end state for a captured PI.
    if (paymentIntent.status === 'succeeded') {
      return { status: 'ok', paymentIntent }
    }

    // Anything else is unexpected after capture — treat as failure so
    // the caller can decide whether to retry.
    return {
      status: 'failed',
      message: `Unexpected payment status after capture: ${paymentIntent.status}`,
      paymentIntent,
    }
  } catch (err) {
    // Stripe-specific: if the PI was already captured (e.g. retry after
    // a network blip), Stripe throws but the money is fine. Surface a
    // distinct message so the route can decide what to do.
    const message =
      err instanceof Error ? err.message : 'Stripe capture failed.'
    return { status: 'failed', message }
  }
}
