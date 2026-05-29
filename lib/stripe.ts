import Stripe from 'stripe'
import { calculatePaymentBreakdown as computeBreakdown } from './payment-math'

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
 * Calculate the full payment breakdown for a gig, using the platform fee
 * percent configured in the environment.
 *
 * Flipper pays: gig amount + platform fee + Stripe fees on top.
 * Worker gets: the FULL gig amount (paid as transfer).
 * Platform gets: configured % of the gig amount.
 *
 * The math lives in lib/payment-math.ts so the confirm modal can reuse it
 * on the client without pulling in the Stripe SDK. All amounts in CENTS.
 */
export function calculatePaymentBreakdown(gigAmountDollars: number) {
  return computeBreakdown(gigAmountDollars, getPlatformFeePercent())
}
