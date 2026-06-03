// ============================================================
// FlipWork — Web Push sender
// ============================================================
// Sends a push notification to every device a user has turned
// notifications on for. Mirrors lib/email.ts: server-side only,
// uses the SERVICE-ROLE Supabase client (so it can read other
// users' subscription rows past RLS), and NEVER throws — a push
// failure must never block the app action that triggered it.
//
// VAPID keys: the PUBLIC key is not secret (it's handed to every
// browser), so it has a safe in-code default. The PRIVATE key must
// be set as VAPID_PRIVATE_KEY in the environment (Vercel). If it's
// missing, push is simply skipped.
// ============================================================

import webpush from 'web-push'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Public key (safe to ship). Override with NEXT_PUBLIC_VAPID_PUBLIC_KEY.
const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BHTTN0akNAU3O04KaEdltM3UbSLgtmzu4wJl4zFhOKOPWhKthof9YiHDi2NsvuQ-q3nZxfmbSZS-LXNe3GZANM4'
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notifications@myflipwork.com'

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_PRIVATE) {
    console.warn('VAPID_PRIVATE_KEY not set — push notifications skipped.')
    return false
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('Supabase service role env vars missing — push skipped.')
    return null
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface SubRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface PushArgs {
  userId: string
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPushToUser({
  userId,
  title,
  body,
  url = '/messages',
  tag,
}: PushArgs): Promise<{ sent: number; skipped?: boolean; error?: boolean }> {
  try {
    if (!ensureConfigured()) return { sent: 0, skipped: true }

    const supabase = getServiceClient()
    if (!supabase) return { sent: 0, skipped: true }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    const rows = (subs as SubRow[] | null) ?? []
    if (rows.length === 0) return { sent: 0 }

    const payload = JSON.stringify({ title, body, url, tag: tag || url })
    let sent = 0
    const deadIds: string[] = []

    await Promise.all(
      rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          sent++
        } catch (err: any) {
          const code = err?.statusCode
          // 404/410 = the subscription is gone for good; clean it up.
          if (code === 404 || code === 410) {
            deadIds.push(s.id)
          } else {
            console.warn('push send failed', code, err?.body || err?.message)
          }
        }
      })
    )

    if (deadIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadIds)
    }

    return { sent }
  } catch (err) {
    console.warn('sendPushToUser error (ignored):', err)
    return { sent: 0, error: true }
  }
}
