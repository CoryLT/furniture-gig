// ============================================================
// POST /api/admin/campaigns/free-year/send
// ============================================================
// Sends the free-year Pro offer email to every eligible user.
//
// Eligible = has email, not admin, not already Pro (paid/founding),
// not unsubscribed from marketing, not already redeemed this
// campaign. Same rule as the preview route.
//
// Send is idempotent per (recipient, campaign): the send helper
// dedupes on idempotencyKey via email_log. Running this twice
// won't double-send anyone.
//
// The route is admin-only. Preflight check for admin role uses
// the caller's own session; the actual sends use the service-role
// client so RLS on subscriptions / prefs doesn't hide anyone.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { renderFreeYearOffer } from '@/lib/campaign-emails'
import { CAMPAIGN_ID } from '@/app/api/offer/free-year/accept/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cap per invocation. Free tier of Resend allows 100/day; a large
// production run should batch across days or upgrade Resend.
const MAX_PER_RUN = 200

export async function POST() {
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

  // Pull everything we need to compute the recipient list. Same
  // set of queries as /preview so the counts match.
  const [usersRes, workerProfilesRes, subsRes, prefsRes, redemptionsRes] =
    await Promise.all([
      admin.from('users').select('id, email, role').not('email', 'is', null),
      admin.from('worker_profiles').select('user_id, first_name, full_name'),
      admin.from('subscriptions').select('user_id, status, is_founding'),
      admin
        .from('notification_preferences')
        .select('user_id, email_marketing, unsubscribe_token'),
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

  const prefsByUser = new Map<
    string,
    { email_marketing: boolean; unsubscribe_token: string }
  >()
  for (const p of (prefsRes.data ?? []) as Array<{
    user_id: string
    email_marketing: boolean
    unsubscribe_token: string
  }>) {
    prefsByUser.set(p.user_id, {
      email_marketing: p.email_marketing,
      unsubscribe_token: p.unsubscribe_token,
    })
  }

  const alreadyRedeemed = new Set<string>()
  for (const r of (redemptionsRes.data ?? []) as Array<{ user_id: string }>) {
    alreadyRedeemed.add(r.user_id)
  }

  // Best-effort first-name lookup. full_name column takes priority
  // (that's the going-forward field per project notes); first_name
  // is the legacy fallback.
  const firstNameByUser = new Map<string, string>()
  for (const w of (workerProfilesRes.data ?? []) as Array<{
    user_id: string
    first_name: string | null
    full_name: string | null
  }>) {
    const full = (w.full_name ?? '').trim()
    if (full) {
      firstNameByUser.set(w.user_id, full.split(/\s+/)[0])
      continue
    }
    if ((w.first_name ?? '').trim()) {
      firstNameByUser.set(w.user_id, (w.first_name as string).trim())
    }
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
    if (alreadyRedeemed.has(u.id)) return false
    const p = prefsByUser.get(u.id)
    // If there's no prefs row at all we treat them as opted-in
    // (the trigger should always create one, but defensive). We
    // just can't include an unsubscribe link in that case — so
    // skip them until the trigger backfills. Rare edge case.
    if (!p) return false
    if (p.email_marketing === false) return false
    return true
  })

  const total = recipients.length
  const toSend = recipients.slice(0, MAX_PER_RUN)

  let sent = 0
  let skipped = 0
  let failed = 0
  const failures: Array<{ email: string; reason: string }> = []

  for (const u of toSend) {
    const pref = prefsByUser.get(u.id)!
    const firstName = firstNameByUser.get(u.id) ?? null
    const email = renderFreeYearOffer({
      firstName,
      unsubscribeToken: pref.unsubscribe_token,
    })

    const result = await sendEmail({
      recipientUserId: u.id,
      recipientEmail: u.email!,
      eventType: 'marketing_offer',
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Dedupe key ties to (user, campaign) — running the send
      // route twice won't email anyone twice.
      idempotencyKey: `marketing_offer:${CAMPAIGN_ID}:${u.id}`,
      relatedEntityId: u.id,
    })

    if (result.status === 'sent') sent++
    else if (
      result.status === 'skipped_duplicate' ||
      result.status === 'skipped_preferences'
    )
      skipped++
    else {
      failed++
      failures.push({ email: u.email!, reason: result.errorMessage || 'unknown' })
    }
  }

  return NextResponse.json({
    success: true,
    campaignId: CAMPAIGN_ID,
    eligible: total,
    attempted: toSend.length,
    sent,
    skipped,
    failed,
    truncated: total > MAX_PER_RUN,
    // Only surface a small sample of failure details.
    failureSample: failures.slice(0, 10),
  })
}
