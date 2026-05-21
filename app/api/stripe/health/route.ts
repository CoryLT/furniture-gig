import { NextResponse } from 'next/server'
import { stripe, getPlatformFeePercent, calculatePaymentBreakdown } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stripe/health
 *
 * Admin-only sanity check that Stripe credentials are configured correctly.
 * Calls Stripe's API to retrieve the account, confirms Connect is enabled,
 * and shows the configured platform fee with example payment math.
 *
 * Used during initial setup. Safe to delete later.
 */
export async function GET() {
  // Require admin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Confirm Stripe secret key is set
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      ok: false,
      reason: 'STRIPE_SECRET_KEY not set in environment',
    }, { status: 500 })
  }

  try {
    // Fetch the platform's Stripe account
    const account = await stripe.accounts.retrieve()

    // Sample math at a $100 gig
    const sampleBreakdown = calculatePaymentBreakdown(100)

    return NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        country: account.country,
        default_currency: account.default_currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
      },
      platform_fee_percent: getPlatformFeePercent(),
      sample_payment_breakdown_for_100_dollar_gig: sampleBreakdown,
      key_type: process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live',
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      reason: 'Stripe API call failed',
      error_type: err?.type ?? 'unknown',
      message: err?.message ?? String(err),
    }, { status: 500 })
  }
}
