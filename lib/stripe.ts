import Stripe from 'stripe'

// Build marker: 2026-05-25 live-mode cutover — forces cold start of cached Stripe client.

if (!process.env.STRIPE_SECRET_KEY_LIVE) {
  // Don't throw at import time — let routes handle missing env gracefully.
  console.warn('STRIPE_SECRET_KEY_LIVE is not set. Stripe routes will fail until it is configured.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_LIVE ?? '', {
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

  // The full amount the worker earns for the gig — they now receive ALL of this.
  const gigAmountCents = Math.round(gigAmountDollars * 100)

  // Platform's revenue: our % of the gig amount. The flipper pays this ON TOP —
  // it is NOT deducted from the worker's pay anymore.
  const platformFeeCents = Math.round((gigAmountCents * platformFeePercent) / 100)

  // Stripe's processing fee (2.9% + 30¢ on US cards) is paid by the platform on
  // the destination charge, so the flipper covers it on top too. Solve for the
  // total charge so that, after Stripe takes its cut, the worker's full gig
  // amount PLUS the platform fee still remain in the platform balance.
  // total - (0.029 * total + 30) = gigAmountCents + platformFeeCents
  // total = (gigAmountCents + platformFeeCents + 30) / 0.971
  const grossCents = Math.ceil((gigAmountCents + platformFeeCents + 30) / 0.971)
  const stripeFeeCents = grossCents - gigAmountCents - platformFeeCents

  // Stripe transfers (grossCents - applicationFeeCents) to the worker. To pay the
  // worker the FULL gig amount, we keep everything above it as the application
  // fee; the platform then nets ~platformFeeCents after Stripe takes its cut.
  const applicationFeeCents = grossCents - gigAmountCents

  return {
    // What the flipper is charged (in cents): gig + platform fee + Stripe fee
    grossCents,
    // What the worker receives (in cents) — now the FULL gig amount
    workerReceivesCents: gigAmountCents,
    // What Stripe collects as application_fee_amount (platform fee + Stripe fee)
    applicationFeeCents,
    // Stripe's processing fee (in cents)
    stripeFeeCents,
    // Platform's net revenue (in cents) — our cut
    platformFeeCents,
    // Original gig amount (in cents)
    gigAmountCents,
    // Helpful dollar versions for display
    grossDollars: grossCents / 100,
    workerReceivesDollars: gigAmountCents / 100,
    stripeFeeDollars: stripeFeeCents / 100,
    platformFeeDollars: platformFeeCents / 100,
  }
}
