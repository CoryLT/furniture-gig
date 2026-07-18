// ============================================================
// GET /api/admin/campaigns/free-year/preview
// ============================================================
// Renders the free-year campaign email against Cory's own account
// so the admin UI can show a "here's what people will get" preview
// before he hits Send. Also returns the recipient list count.
//
// The recipient rule (mirrored by the send route) is:
//   - has an email address on file
//   - is NOT already on paid or founding Pro
//   - has NOT unsubscribed from marketing
//   - is NOT the admin (Cory) — no need to email himself
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderFreeYearOffer } from '@/lib/campaign-emails'
import { CAMPAIGN_ID } from '@/app/api/offer/free-year/accept/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((me as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Pull everything we need to compute the recipient list.
  const [usersRes, subsRes, prefsRes, redemptionsRes] = await Promise.all([
    admin
      .from('users')
      .select('id, email, role')
      .not('email', 'is', null),
    admin.from('subscriptions').select('user_id, status, is_founding'),
    admin
      .from('notification_preferences')
      .select('user_id, email_marketing'),
    admin
      .from('campaign_redemptions')
      .select('user_id')
      .eq('campaign_id', CAMPAIGN_ID),
  ])

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').toLowerCase()

  const paidUserIds = new Set<string>()
  for (const s of (subsRes.data ?? []) as Array<{
    user_id: string
    status: string | null
    is_founding: boolean | null
  }>) {
    if (s.is_founding || s.status === 'active' || s.status === 'trialing') {
      paidUserIds.add(s.user_id)
    }
  }

  const unsubscribed = new Set<string>()
  for (const p of (prefsRes.data ?? []) as Array<{
    user_id: string
    email_marketing: boolean
  }>) {
    if (p.email_marketing === false) unsubscribed.add(p.user_id)
  }

  const alreadyRedeemed = new Set<string>()
  for (const r of (redemptionsRes.data ?? []) as Array<{ user_id: string }>) {
    alreadyRedeemed.add(r.user_id)
  }

  const recipients = ((usersRes.data ?? []) as Array<{
    id: string
    email: string | null
    role: string | null
  }>).filter((u) => {
    if (!u.email) return false
    if (u.role === 'admin') return false
    if (adminEmail && u.email.toLowerCase() === adminEmail) return false
    if (paidUserIds.has(u.id)) return false
    if (unsubscribed.has(u.id)) return false
    if (alreadyRedeemed.has(u.id)) return false
    return true
  })

  // For the preview body, use the admin's own unsubscribe token if
  // we have one. Falls back to a placeholder if not — the preview
  // is never actually sent to a real recipient.
  const { data: myPref } = await admin
    .from('notification_preferences')
    .select('unsubscribe_token')
    .eq('user_id', user.id)
    .maybeSingle()
  const previewToken =
    ((myPref as any)?.unsubscribe_token as string | undefined) ||
    '00000000-0000-0000-0000-000000000000'

  const email = renderFreeYearOffer({
    firstName: null, // Preview greeting: 'Hey,' — matches unpersonalized fallback
    unsubscribeToken: previewToken,
  })

  return NextResponse.json({
    recipientCount: recipients.length,
    preview: {
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
  })
}
