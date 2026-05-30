import { NextResponse } from 'next/server'
import {
  getPayPalAccessToken,
  getPayPalEnv,
  getPlatformFeePercent,
  PAYPAL_BASE_URL,
} from '@/lib/paypal'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/paypal/health
 *
 * Admin-only sanity check that PayPal credentials are configured correctly.
 * Asks PayPal for an access token (which proves the keys work), reports
 * whether this is sandbox or live, and whether Payouts is granted yet.
 *
 * Used during setup. Safe to delete later.
 */
export async function GET() {
  // Require an admin user
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  // Safe diagnostic: presence + short prefix only (never the full secret).
  const diagnostic = {
    PAYPAL_ENV: getPayPalEnv(),
    PAYPAL_BASE_URL,
    PAYPAL_CLIENT_ID_present: !!process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_ID_prefix: (process.env.PAYPAL_CLIENT_ID ?? '').slice(0, 8),
    PAYPAL_CLIENT_SECRET_present: !!process.env.PAYPAL_CLIENT_SECRET,
    all_paypal_env_var_names: Object.keys(process.env).filter((k) =>
      k.toUpperCase().includes('PAYPAL')
    ),
  }

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set in environment',
        diagnostic,
      },
      { status: 500 }
    )
  }

  try {
    const token = await getPayPalAccessToken()
    const scope = token.scope ?? ''
    const grantedScopes = scope.split(' ').filter(Boolean)
    const payoutsEnabled = scope.toLowerCase().includes('payouts')

    return NextResponse.json({
      ok: true,
      env: getPayPalEnv(),
      app_id: token.app_id ?? null,
      token_expires_in_seconds: token.expires_in,
      payouts_enabled_for_this_app: payoutsEnabled,
      platform_fee_percent: getPlatformFeePercent(),
      granted_scopes: grantedScopes,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'PayPal API call failed',
        message: err?.message ?? String(err),
        diagnostic,
      },
      { status: 500 }
    )
  }
}
