import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

// POST /api/messages/notify
// Body: { conversationKind: 'gig' | 'listing' | 'user', conversationId: string }
//
// Called by the chat client right after a message is successfully sent.
// Figures out the OTHER participant and emails them about the new message,
// respecting their notification preferences and de-duplicating so they
// get at most one email per conversation per hour.
//
// Best-effort: any failure returns ok:false but never blocks the sender.
const KINDS = ['gig', 'listing', 'user']

export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let conversationKind: string | null = null
  let conversationId: string | null = null
  try {
    const body = await req.json()
    conversationKind = body?.conversationKind ?? null
    conversationId = body?.conversationId ?? null
  } catch {
    // handled below
  }

  if (!conversationKind || !conversationId || !KINDS.includes(conversationKind)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Resolve the recipient (the other participant) per conversation kind.
  let recipientId: string | null = null
  if (conversationKind === 'gig') {
    const { data: c } = await supabase
      .from('gig_conversations')
      .select('flipper_user_id, worker_user_id')
      .eq('id', conversationId)
      .maybeSingle<{ flipper_user_id: string; worker_user_id: string }>()
    if (c) {
      recipientId =
        c.flipper_user_id === user.id ? c.worker_user_id : c.flipper_user_id
    }
  } else if (conversationKind === 'listing') {
    const { data: c } = await supabase
      .from('listing_conversations')
      .select('seller_user_id, buyer_user_id')
      .eq('id', conversationId)
      .maybeSingle<{ seller_user_id: string; buyer_user_id: string }>()
    if (c) {
      recipientId =
        c.seller_user_id === user.id ? c.buyer_user_id : c.seller_user_id
    }
  } else {
    const { data: c } = await supabase
      .from('user_conversations')
      .select('user_a_id, user_b_id')
      .eq('id', conversationId)
      .maybeSingle<{ user_a_id: string; user_b_id: string }>()
    if (c) {
      recipientId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id
    }
  }

  if (!recipientId || recipientId === user.id) {
    // Can't determine recipient, or caller isn't a participant.
    return NextResponse.json({ ok: false, reason: 'no_recipient' })
  }

  // Look up the recipient's email + the sender's display name.
  const { data: recipientRow } = await supabase
    .from('users')
    .select('email' as any)
    .eq('id', recipientId)
    .maybeSingle()
  const recipientEmail = (recipientRow as any)?.email as string | null
  if (!recipientEmail) {
    return NextResponse.json({ ok: false, reason: 'no_email' })
  }

  // Sender's name (best effort: worker_profiles.full_name, else "Someone")
  const { data: senderProfile } = await supabase
    .from('worker_profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle<{ full_name: string }>()
  const senderName =
    (senderProfile?.full_name || '').trim() || 'Someone'

  const messagesUrl = `https://myflipwork.com/messages/${conversationId}`

  // Dedup bucket: at most one email per conversation per recipient per hour.
  const hourBucket = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
  const idempotencyKey = `new_message:${conversationId}:${recipientId}:${hourBucket}`

  const result = await sendEmail({
    recipientUserId: recipientId,
    recipientEmail,
    eventType: 'new_message',
    subject: `New message from ${senderName} on FlipWork`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">You have a new message</h1>
        <p style="font-size: 14px; line-height: 1.5; color: #444;">
          <strong>${escapeHtml(senderName)}</strong> sent you a message on FlipWork.
        </p>
        <p style="margin: 20px 0;">
          <a href="${messagesUrl}" style="display: inline-block; background: hsl(32 90% 48%); color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Read &amp; reply
          </a>
        </p>
        <p style="font-size: 12px; color: #888; margin-top: 24px;">
          You're getting this because message notifications are on. You can
          turn them off in your FlipWork notification settings.
        </p>
      </div>
    `,
    text: `${senderName} sent you a message on FlipWork. Read and reply: ${messagesUrl}`,
    idempotencyKey,
    relatedEntityId: conversationId,
  })

  return NextResponse.json({ ok: result.status === 'sent', status: result.status })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
