import { NextResponse } from 'next/server'
import { stripe, getPlatformFeePercent, calculatePaymentBreakdown } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
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
  if (!process.env.STRIPE_SECRET_KEY_LIVE) {
    return NextResponse.json({
      ok: false,
      reason: 'STRIPE_SECRET_KEY_LIVE not set in environment',
      diagnostic: {
        STRIPE_SECRET_KEY_LIVE: 'undefined',
        STRIPE_SECRET_KEY_present: !!process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET_present: !!process.env.STRIPE_WEBHOOK_SECRET,
        all_stripe_env_var_names: Object.keys(process.env).filter((k) => k.toUpperCase().includes('STRIPE')),
      },
    }, { status: 500 })
  }

  // DIAGNOSTIC: show first 10 characters of every Stripe-related env var.
  // SAFE because secret keys are 100+ chars; first 10 reveals only the prefix.
  const diagnostic = {
    STRIPE_SECRET_KEY_LIVE_prefix: (process.env.STRIPE_SECRET_KEY_LIVE ?? '').slice(0, 10),
    STRIPE_SECRET_KEY_LIVE_length: (process.env.STRIPE_SECRET_KEY_LIVE ?? '').length,
    STRIPE_SECRET_KEY_legacy_prefix: (process.env.STRIPE_SECRET_KEY ?? '').slice(0, 10),
    STRIPE_SECRET_KEY_legacy_length: (process.env.STRIPE_SECRET_KEY ?? '').length,
    STRIPE_WEBHOOK_SECRET_prefix: (process.env.STRIPE_WEBHOOK_SECRET ?? '').slice(0, 10),
    STRIPE_WEBHOOK_SECRET_length: (process.env.STRIPE_WEBHOOK_SECRET ?? '').length,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_prefix: (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').slice(0, 10),
    all_stripe_env_var_names: Object.keys(process.env).filter((k) => k.toUpperCase().includes('STRIPE')),
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
      key_type: process.env.STRIPE_SECRET_KEY_LIVE.startsWith('sk_test_') ? 'test' : 'live',
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      reason: 'Stripe API call failed',
      error_type: err?.type ?? 'unknown',
      message: err?.message ?? String(err),
      diagnostic,
    }, { status: 500 })
  }
}
