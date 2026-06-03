import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeToken } from '@/lib/quickbooks'
import { getSiteUrl } from '@/lib/utils'

// POST /api/quickbooks/disconnect
// Tells Intuit to forget the token (best effort), then removes our stored
// connection. Submitted by a plain form on the settings page.
export async function POST() {
  const site = getSiteUrl()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${site}/auth/login`, { status: 303 })
  }

  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('quickbooks_connections')
    .select('refresh_token')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (conn?.refresh_token) {
    await revokeToken(conn.refresh_token)
  }
  await admin.from('quickbooks_connections').delete().eq('owner_user_id', user.id)

  return NextResponse.redirect(`${site}/flipper/quickbooks?disconnected=1`, {
    status: 303,
  })
}
