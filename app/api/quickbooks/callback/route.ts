import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens, qbConfig } from '@/lib/quickbooks'
import { getSiteUrl } from '@/lib/utils'

// GET /api/quickbooks/callback
// Step 2: Intuit sends the user back here with a one-time code, the company
// id (realmId), and the state we set earlier. We check the state, trade the
// code for tokens, and save the connection. Then we bounce to the settings page.
export async function GET(req: Request) {
  const site = getSiteUrl()
  const settings = `${site}/flipper/quickbooks`

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${site}/auth/login`)
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${settings}?error=${encodeURIComponent(oauthError)}`)
  }

  const cookieState = cookies().get('qb_oauth_state')?.value
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${settings}?error=state_mismatch`)
  }
  if (!code || !realmId) {
    return NextResponse.redirect(`${settings}?error=missing_code`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const now = Date.now()
    const accessExpiresAt = new Date(now + tokens.expires_in * 1000).toISOString()
    const refreshExpiresAt = new Date(
      now + tokens.x_refresh_token_expires_in * 1000
    ).toISOString()

    const admin = createAdminClient()
    const { error: dbErr } = await admin.from('quickbooks_connections').upsert(
      {
        owner_user_id: user.id,
        realm_id: realmId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_expires_at: accessExpiresAt,
        refresh_expires_at: refreshExpiresAt,
        environment: qbConfig().environment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id' }
    )
    if (dbErr) {
      console.error('[quickbooks] save error:', dbErr)
      return NextResponse.redirect(`${settings}?error=save_failed`)
    }
  } catch (e) {
    console.error('[quickbooks] token exchange error:', e)
    return NextResponse.redirect(`${settings}?error=exchange_failed`)
  }

  const res = NextResponse.redirect(`${settings}?connected=1`)
  res.cookies.set('qb_oauth_state', '', { path: '/', maxAge: 0 })
  return res
}
