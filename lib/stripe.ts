import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  // Don't throw at import time — let routes handle missing env gracefully.
  console.warn('STRIPE_SECRET_KEY is not set. Stripe routes will fail until it is configured.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
  typescript: true,
  appInfo: {
    name: 'FlipWork',
    version: '0.1.0',
  },
})

/**
 * Platform fee percentage (e.g. 2 = 2%).
 * Configured in Vercel env. Defaults to 2 if unset.
 */
export function getPlatformFeePercent(): number {
  const raw = process.env.STRIPE_PLATFORM_FEE_PERCENT
  if (!raw) return 2
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 2
}

/**
 * Calculate the full payment breakdown for a gig.
 *
 * Flipper pays: gig amount + Stripe fees on top.
 * Worker gets: full gig amount (paid as transfer).
 * Platform gets: configured % of the gig amount.
 *
 * All amounts are returned in CENTS (Stripe's unit).
 */
export function calculatePaymentBreakdown(gigAmountDollars: number) {
  const platformFeePercent = getPlatformFeePercent()

  // Worker's gross pay (what they earn for the gig)
  const gigAmountCents = Math.round(gigAmountDollars * 100)

  // Platform's cut (deducted from the gig amount via application_fee_amount)
  const platformFeeCents = Math.round((gigAmountCents * platformFeePercent) / 100)

  // Stripe's fees: 2.9% + 30¢ (US cards)
  // Solve for total so that after Stripe takes its cut, gigAmountCents remains.
  // total - (0.029 * total + 30) = gigAmountCents
  // total * (1 - 0.029) = gigAmountCents + 30
  // total = (gigAmountCents + 30) / 0.971
  const grossCents = Math.ceil((gigAmountCents + 30) / 0.971)
  const stripeFeeCents = grossCents - gigAmountCents

  return {
    // What flipper is charged (in cents)
    grossCents,
    // What worker receives (in cents) — full gig amount
    workerReceivesCents: gigAmountCents - platformFeeCents,
    // Stripe's processing fee (in cents)
    stripeFeeCents,
    // Platform's fee (in cents) — what we keep
    platformFeeCents,
    // Original gig amount (in cents)
    gigAmountCents,
    // Helpful dollar versions for display
    grossDollars: grossCents / 100,
    workerReceivesDollars: (gigAmountCents - platformFeeCents) / 100,
    stripeFeeDollars: stripeFeeCents / 100,
    platformFeeDollars: platformFeeCents / 100,
  }
}
