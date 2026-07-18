import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  anthropic,
  SUPPORT_MODEL,
  MAX_MESSAGES_PER_CONVERSATION,
  MAX_CONVERSATIONS_PER_USER_PER_DAY,
} from '@/lib/anthropic'
import { SUPPORT_SYSTEM_PROMPT } from '@/lib/support-prompt'
import { SUPPORT_TOOLS, runTool } from '@/lib/support-tools'
import { sendEmail } from '@/lib/email'
import { getSiteUrl } from '@/lib/utils'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Stock reply shown when the user sends a message in a conversation
// that's already flagged for admin follow-up. We keep the AI out of
// the loop so Cory can respond himself.
const ESCALATED_ACK =
  "Thanks — I've added your message to the chat and pinged the admin so they see it. They'll follow up here."

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/support/chat
// Body: { conversationId?: string, message: string }
//   - If conversationId is omitted, a new conversation is created.
//   - Returns: { conversationId, reply, status }
//   - status is the conversation's status after this turn
//     (active / resolved / escalated)
export async function POST(req: Request) {
  const supabase = createClient()
  const admin = createAdminClient()

  // ---------- auth ----------
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ---------- parse body ----------
  let body: { conversationId?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const incomingMessage = (body.message || '').trim()
  if (!incomingMessage) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }
  if (incomingMessage.length > 4000) {
    return NextResponse.json(
      { error: 'Message too long. Please shorten and try again.' },
      { status: 400 }
    )
  }

  // ---------- find or create conversation ----------
  let conversationId = body.conversationId || null

  if (conversationId) {
    // Verify the user owns this conversation
    const { data: convo } = await admin
      .from('support_conversations')
      .select('id, user_id, status, message_count')
      .eq('id', conversationId)
      .maybeSingle()

    if (!convo || (convo as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if ((convo as any).status === 'resolved') {
      return NextResponse.json(
        {
          error:
            'This conversation is closed. Start a new one if you have another question.',
        },
        { status: 400 }
      )
    }
    if ((convo as any).message_count >= MAX_MESSAGES_PER_CONVERSATION) {
      return NextResponse.json(
        { error: "This conversation has reached its length limit. Please start a new one." },
        { status: 400 }
      )
    }

    // If the chat is already flagged for admin, we don't invoke the AI
    // for follow-up messages — those belong to Cory. Save the message,
    // ping Cory, add a stock acknowledgement, and return.
    if ((convo as any).status === 'escalated') {
      await admin.from('support_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: incomingMessage,
      } as any)

      await admin.from('support_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: ESCALATED_ACK,
      } as any)

      await admin
        .from('support_conversations')
        .update({
          message_count: ((convo as any).message_count || 0) + 2,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', conversationId)

      // Best-effort ping so Cory knows there's a fresh message on an
      // already-escalated chat. Dedupe key stays on the conversation
      // so we don't spam him with an email per user reply — the
      // email helper will skip the duplicate.
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
            subject: 'FlipWork support — new message on an escalated chat',
            html:
              `<p>The user replied on an already-escalated support chat.</p>` +
              `<p><b>From:</b> ${escapeHtml(userEmail)}</p>` +
              `<p><b>Message:</b> ${escapeHtml(incomingMessage)}</p>` +
              `<p><a href="${link}">Open the conversation →</a></p>`,
            text:
              `The user replied on an already-escalated support chat.\n\n` +
              `From: ${userEmail}\n` +
              `Message: ${incomingMessage}\n\n` +
              `Open: ${link}`,
            idempotencyKey: `support_escalation:${conversationId}`,
            relatedEntityId: conversationId,
          })
        }
      } catch (e) {
        console.warn('escalated reply email failed (ignored):', e)
      }

      return NextResponse.json({
        conversationId,
        reply: ESCALATED_ACK,
        status: 'escalated',
        escalated: true,
      })
    }
  } else {
    // Check daily rate limit
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
            "You've reached the daily limit for new support chats. Please try again tomorrow.",
        },
        { status: 429 }
      )
    }

    // Create new conversation
    const { data: newConvo, error: createErr } = await admin
      .from('support_conversations')
      .insert({ user_id: user.id, status: 'active' } as any)
      .select('id')
      .single()

    if (createErr || !newConvo) {
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }
    conversationId = (newConvo as any).id
  }

  // ---------- save user message ----------
  await admin.from('support_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: incomingMessage,
  } as any)

  // ---------- load full conversation history for Claude ----------
  const { data: history } = await admin
    .from('support_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // Convert to Anthropic message format. Skip 'system' role messages
  // (we have a separate system prompt).
  const messagesForClaude = (history || [])
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .map((m: any) => ({ role: m.role, content: m.content }))

  // ---------- call Claude with tool-use loop ----------
  // We call Claude. If it returns tool_use blocks, we run each tool,
  // append the results, and call Claude again. Loop until it returns
  // a plain text answer (or hits the safety cap).
  const MAX_TOOL_ROUNDS = 5
  let assistantText = ''
  let escalated = false

  // Use a working copy that we mutate as we add tool results
  const working: any[] = [...messagesForClaude]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response
    try {
      response = await anthropic.messages.create({
        model: SUPPORT_MODEL,
        max_tokens: 1024,
        system: SUPPORT_SYSTEM_PROMPT,
        tools: SUPPORT_TOOLS as any,
        messages: working,
      })
    } catch (err: any) {
      console.error('Anthropic API error:', err)
      return NextResponse.json(
        {
          error:
            "Sorry, the support assistant is having trouble right now. Please try again in a moment.",
        },
        { status: 502 }
      )
    }

    // Collect any text from this turn
    const textBlocks = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
    if (textBlocks) {
      assistantText = textBlocks
    }

    // If Claude wants to use tools, run them and continue the loop
    const toolUseBlocks = response.content.filter(
      (b: any) => b.type === 'tool_use'
    )

    if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
      // Done — Claude finished without asking for more tools
      break
    }

    // Push the assistant message that contained the tool_use blocks
    working.push({ role: 'assistant', content: response.content })

    // Run each tool, push the results as a user message
    const toolResults: any[] = []
    for (const tu of toolUseBlocks as any[]) {
      const result = await runTool(
        tu.name,
        tu.input || {},
        user.id,
        conversationId!
      )
      if (tu.name === 'escalate_to_admin') escalated = true
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result.result,
      })
    }
    working.push({ role: 'user', content: toolResults })
  }

  if (!assistantText) {
    assistantText =
      "I'm having trouble forming a response. Could you try rephrasing your question?"
  }

  // ---------- save assistant message ----------
  await admin.from('support_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: assistantText,
  } as any)

  // ---------- fetch final status (the escalate tool may have changed it) ----------
  const { data: finalConvo } = await admin
    .from('support_conversations')
    .select('status')
    .eq('id', conversationId)
    .maybeSingle()

  return NextResponse.json({
    conversationId,
    reply: assistantText,
    status: (finalConvo as any)?.status || 'active',
    escalated,
  })
}
