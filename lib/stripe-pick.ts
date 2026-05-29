import { stripe, calculatePaymentBreakdown } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * Result of attempting to authorize a payment when a flipper picks a worker.
 *
 * - 'ok'            → PaymentIntent created and authorized. Money held.
 * - 'requires_action' → Stripe needs the cardholder to do 3D Secure.
 *                       Frontend should confirm with paymentIntent.client_secret.
 * - 'failed'        → Authorization failed (declined, expired card, etc).
 */
export type AuthorizePickResult =
  | {
      status: 'ok'
      paymentIntent: Stripe.PaymentIntent
      breakdown: ReturnType<typeof calculatePaymentBreakdown>
    }
  | {
      status: 'requires_action'
      paymentIntent: Stripe.PaymentIntent
      breakdown: ReturnType<typeof calculatePaymentBreakdown>
      clientSecret: string
    }
  | {
      status: 'failed'
      message: string
      paymentIntent?: Stripe.PaymentIntent
    }

interface AuthorizePickInput {
  /** Flipper's Stripe Customer ID (must already exist) */
  customerId: string
  /** Worker's Stripe Connect Express account ID (must have charges_enabled) */
  workerStripeAccountId: string
  /** Gig amount in DOLLARS (what's advertised on the gig) */
  gigAmountDollars: number
  /** For idempotency + traceability */
  gigId: string
  claimId: string
}

/**
 * Authorize (hold) money on the flipper's saved card.
 * Does NOT capture — money sits frozen until admin approves the work.
 *
 * Why manual capture: if the work gets rejected later, we cancel the
 * authorization and the flipper is never actually charged.
 *
 * Why off_session + confirm: the flipper isn't actively typing their card
 * info at this moment — they're picking a worker and we charge their
 * already-saved card in the background.
 */
export async function authorizePickPayment(
  input: AuthorizePickInput
): Promise<AuthorizePickResult> {
  const breakdown = calculatePaymentBreakdown(input.gigAmountDollars)

  // Fetch the customer's default payment method.
  // We need the actual PM ID for off-session confirm.
  let paymentMethodId: string | null = null
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: input.customerId,
      type: 'card',
      limit: 1,
    })
    if (paymentMethods.data.length === 0) {
      return {
        status: 'failed',
        message: 'No saved card found. Please add a payment method first.',
      }
    }
    paymentMethodId = paymentMethods.data[0].id
  } catch (err) {
    return {
      status: 'failed',
      message:
        err instanceof Error
          ? `Could not look up payment method: ${err.message}`
          : 'Could not look up payment method.',
    }
  }

  // Create the PaymentIntent.
  // - amount: what flipper pays (gig + our 2% + Stripe processing fees on top)
  // - application_fee_amount: 2% cut + Stripe fee; what's left transfers to worker
  // - transfer_data.destination: worker's Connect account (gets the FULL gig amount)
  // - capture_method: 'manual' → hold only, no money moves yet
  // - off_session + confirm: charge the saved card right now without user interaction
  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: breakdown.grossCents,
        currency: 'usd',
        customer: input.customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        capture_method: 'manual',
        application_fee_amount: breakdown.applicationFeeCents,
        transfer_data: {
          destination: input.workerStripeAccountId,
        },
        metadata: {
          gig_id: input.gigId,
          claim_id: input.claimId,
          purpose: 'authorize_on_pick',
        },
        description: `FlipWork gig authorization (claim ${input.claimId})`,
      },
      {
        // Idempotency: if this exact pick is retried (network blip, double
        // click), Stripe returns the original PaymentIntent instead of
        // double-charging.
        idempotencyKey: `pick:${input.claimId}`,
      }
    )

    // Off-session + confirm normally lands in 'requires_capture' (authorized,
    // ready for later capture). If Stripe needs 3D Secure, we get
    // 'requires_action' and the frontend has to walk the user through it.
    if (paymentIntent.status === 'requires_capture') {
      return { status: 'ok', paymentIntent, breakdown }
    }

    if (paymentIntent.status === 'requires_action') {
      return {
        status: 'requires_action',
        paymentIntent,
        breakdown,
        clientSecret: paymentIntent.client_secret ?? '',
      }
    }

    // Anything else (succeeded, processing, requires_payment_method, canceled)
    // is unexpected here — treat as a failure so we don't lock in the pick.
    return {
      status: 'failed',
      message: `Unexpected payment status: ${paymentIntent.status}`,
      paymentIntent,
    }
  } catch (err) {
    // Stripe errors land here — declined card, expired, fraud block, etc.
    const message =
      err instanceof Error ? err.message : 'Stripe authorization failed.'
    return { status: 'failed', message }
  }
}

/**
 * Cancel an authorization. Used when the DB-side approve_applicant call fails
 * after we've already held the money, so we release the hold cleanly.
 */
export async function cancelPickAuthorization(paymentIntentId: string) {
  try {
    return await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (err) {
    // Best-effort cancel. Log and move on; admin can clean up via Stripe
    // dashboard if needed.
    console.error('[stripe-pick] Failed to cancel PaymentIntent', {
      paymentIntentId,
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}
