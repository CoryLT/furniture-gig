// ============================================================
// payment-math.ts
// ============================================================
// Pure payment math — NO Stripe SDK import, so this is safe to use in
// client components (the pick-worker confirm modal) as well as on the
// server. lib/stripe.ts wraps this with the env-configured fee percent.
//
// Model:
//   • Worker receives the FULL gig amount.
//   • Platform keeps its % of the gig amount as revenue.
//   • Flipper pays gig + platform fee + Stripe processing fee on top.
//   • All amounts returned in CENTS (Stripe's unit).
// ============================================================

export const DEFAULT_PLATFORM_FEE_PERCENT = 2

export function calculatePaymentBreakdown(
  gigAmountDollars: number,
  platformFeePercent: number = DEFAULT_PLATFORM_FEE_PERCENT
) {
  // The full amount the worker earns for the gig — they receive ALL of this.
  const gigAmountCents = Math.round(gigAmountDollars * 100)

  // Platform's revenue: our % of the gig amount. The flipper pays this ON TOP —
  // it is NOT deducted from the worker's pay.
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
    // What the worker receives (in cents) — the FULL gig amount
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
