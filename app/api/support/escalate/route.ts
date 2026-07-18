// ============================================================
// POST /api/support/escalate
// ============================================================
// Powers the "Talk to a person" button on /support.
//
// Body: { conversationId?: string, note?: string }
//   - If conversationId is provided, escalate that conversation.
//   - If not, create a fresh conversation and escalate it (so a
//     user who hasn't chatted yet can still ask for a human).
//   - note is an optional short line from the user about why —
//     saved as their first message if we create a new convo.
//
// This mirrors what the AI's escalate_to_admin tool does, but is
// user-triggered — no LLM in the loop. That means it fires even
// when the AI is down, and it works whether or not the user knew
// the magic words to trigger auto-escalation.
//
// Effects:
//   - Ensures a conversation exists and its status is 'escalated'
//   - Records escalation_reason='human_requested' + a summary
//   - Adds a stock assistant message so the chat has a visible
//     "we got it" acknowledgement
//   - Emails Cory (NEXT_PUBLIC_ADMIN_EMAIL) with a link to the
//     admin view of the conversation
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { getSiteUrl } from '@/lib/utils'
import { MAX_CONVERSATIONS_PER_USER_PER_DAY } from '@/lib/anthropic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ACK_MESSAGE =
  "I've flagged this for our admin — they'll follow up here in this chat, and you'll get a notification when they reply. If it's urgent, you can also email CoryThacker@proton.me."

export async function POST(req: Request) {
  const supabase = createClient()

  // --- auth ---
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- parse body ---
  let body: { conversationId?: string; note?: string } = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine — treat as "new conversation, no note"
  }
  const rawNote = (body.note || '').trim()
  const note = rawNote.length > 4000 ? rawNote.slice(0, 4000) : rawNote

  const admin = createAdminClient()
  let conversationId = (body.conversationId || '').trim() || null

  // --- find or create the conversation ---
  if (conversationId) {
    const { data: existing } = await admin
      .from('support_conversations')
      .select('id, user_id, status')
      .eq('id', conversationId)
      .maybeSingle()

    if (!existing || (existing as any).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Already resolved chats can't be re-escalated — start a new one.
    if ((existing as any).status === 'resolved') {
      conversationId = null
    }
  }

  if (!conversationId) {
    // Rate limit new conversations the same way /api/support/chat does.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await admin
      .from('support_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())

    if ((count || 0) >= MAX_CONVERSATIONS_PER_USER_PER_DAY) {
      return NextResponse.json(
        {
          error:
            "You've reached the daily limit for new support chats. Please email CoryThacker@proton.me directly.",
        },
        { status: 429 }
      )
    }

    const { data: fresh, error: createErr } = await admin
      .from('support_conversations')
      .insert({ user_id: user.id, status: 'active' } as any)
      .select('id')
      .single()

    if (createErr || !fresh) {
      console.error('escalate: create conversation failed', createErr)
      return NextResponse.json(
        { error: 'Failed to start conversation' },
        { status: 500 }
      )
    }
    conversationId = (fresh as any).id
  }

  // --- save the user's note (if any) as their first message ---
  if (note) {
    await admin.from('support_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: note,
    } as any)
  }

  // --- mark escalated ---
  await admin
    .from('support_conversations')
    .update({
      status: 'escalated',
      escalation_reason: 'human_requested',
      summary: note
        ? `User asked for a person: ${note.slice(0, 300)}`
        : 'User clicked "Talk to a person".',
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', conversationId)

  // --- add an assistant acknowledgement so the user sees something ---
  await admin.from('support_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: ACK_MESSAGE,
  } as any)

  // --- email Cory (best effort) ---
  try {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (adminEmail) {
      let userEmail = 'a user'
      try {
        const { data: u } = await admin.auth.admin.getUserById(user.id)
        if (u?.user?.email) userEmail = u.user.email
      } catch {
        /* fall back */
      }
      const link = `${getSiteUrl()}/admin/support/${conversationId}`
      await sendEmail({
        recipientUserId: null,
        recipientEmail: adminEmail,
        eventType: 'support_escalation',
        subject: 'FlipWork support escalation — human_requested',
        html:
          `<p>A user asked to talk to a person.</p>` +
          `<p><b>From:</b> ${escapeHtml(userEmail)}</p>` +
          (note
            ? `<p><b>What they said:</b> ${escapeHtml(note)}</p>`
            : '<p>(No note — they just clicked the button.)</p>') +
          `<p><a href="${link}">Open the conversation →</a></p>`,
        text:
          `A user asked to talk to a person.\n\n` +
          `From: ${userEmail}\n` +
          (note ? `Note: ${note}\n\n` : '\n') +
          `Open: ${link}`,
        idempotencyKey: `support_escalation:${conversationId}`,
        relatedEntityId: conversationId,
      })
    }
  } catch (e) {
    console.warn('escalate: email failed (ignored):', e)
  }

  return NextResponse.json({
    success: true,
    conversationId,
    status: 'escalated',
  })
}
