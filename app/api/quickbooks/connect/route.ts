import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl, qbIsConfigured } from '@/lib/quickbooks'
import { getSiteUrl } from '@/lib/utils'

// GET /api/quickbooks/connect
// Step 1 of the connect flow: send the signed-in user over to Intuit to
// approve the link. We stash a random "state" value in a cookie so we can
// confirm, on the way back, that the response is the one we started.
export async function GET() {
  const site = getSiteUrl()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${site}/auth/login`)
  }
  if (!qbIsConfigured()) {
    return NextResponse.redirect(`${site}/flipper/quickbooks?error=not_configured`)
  }

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(buildAuthorizeUrl(state))
  res.cookies.set('qb_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes to finish approving
  })
  return res
}
