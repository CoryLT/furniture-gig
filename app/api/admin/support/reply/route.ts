// ============================================================
// POST /api/admin/support/reply
// ============================================================
// Cory replies to a support conversation from the admin queue.
//
// Body: { conversationId: string, message: string }
//
// What happens:
//   1. Verify the caller is an admin (public.users.role = 'admin').
//   2. Save the reply into support_messages with role='assistant'
//      so it shows up on the same side as AI replies in the chat UI.
//      (We still know it was Cory because we set is_admin_reply=true
//      if that column exists — it's a nice-to-have; the app doesn't
//      require it to render.)
//   3. Bump support_conversations.updated_at + message_count.
//      Keep status='escalated' so the conversation stays in the
//      admin queue and future user replies keep routing to Cory
//      instead of the AI.
//   4. Push-notify the user so they know Cory replied.
//
// If push fails, we don't fail the request — the message is still
// saved and the user will see it next time they open /support.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createClient()

  // --- auth ---
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if ((me as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- parse body ---
  let body: { conversationId?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const conversationId = (body.conversationId || '').trim()
  const message = (body.message || '').trim()

  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: 'Message too long — please shorten it.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // --- confirm the conversation exists + grab the recipient user_id ---
  const { data: convo } = await admin
    .from('support_conversations')
    .select('id, user_id, message_count, status')
    .eq('id', conversationId)
    .maybeSingle()

  if (!convo) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    )
  }
  const recipientId = (convo as any).user_id as string

  // --- save the reply as an assistant message ---
  // Try including is_admin_reply so the UI can label it later if we
  // want. If the column doesn't exist yet the insert falls back
  // without it — we don't want a missing column to block the reply.
  let insertErr: any = null
  {
    const first = await admin.from('support_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: message,
      is_admin_reply: true,
    } as any)
    insertErr = first.error

    if (insertErr && (insertErr.code === '42703' || insertErr.code === 'PGRST204')) {
      // Column doesn't exist — retry without it.
      const retry = await admin.from('support_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: message,
      } as any)
      insertErr = retry.error
    }
  }

  if (insertErr) {
    console.error('admin reply insert failed:', insertErr)
    return NextResponse.json(
      { error: 'Failed to save reply' },
      { status: 500 }
    )
  }

  // --- bump conversation metadata ---
  // Keep status='escalated' so the conversation stays in Cory's queue
  // and the next user reply keeps routing to him (not the AI).
  await admin
    .from('support_conversations')
    .update({
      message_count: ((convo as any).message_count || 0) + 1,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', conversationId)

  // --- push-notify the user (best-effort) ---
  try {
    await sendPushToUser({
      userId: recipientId,
      title: 'FlipWork support replied',
      body:
        message.length > 120 ? message.slice(0, 117) + '…' : message,
      url: '/support',
      tag: `support:${conversationId}`,
    })
  } catch (e) {
    console.warn('admin reply push failed (ignored):', e)
  }

  return NextResponse.json({ success: true })
}
