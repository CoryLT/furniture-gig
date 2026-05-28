import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/messages/report
// Body: {
//   conversationKind: 'gig' | 'listing' | 'user',
//   conversationId: string,
//   reason?: string
// }
// Returns: { ok: true }
//
// Files a report for admin review. We attach the most recent message in
// the conversation as the reference point (message_reports needs a
// message_id). If there are no messages, we still record the report
// using the conversation id as the message_id reference.
const KINDS = ['gig', 'listing', 'user']
const MSG_TABLE: Record<string, string> = {
  gig: 'gig_messages',
  listing: 'listing_messages',
  user: 'user_messages',
}

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
  let reason = ''
  try {
    const body = await req.json()
    conversationKind = body?.conversationKind ?? null
    conversationId = body?.conversationId ?? null
    reason = (body?.reason ?? '').toString().slice(0, 1000)
  } catch {
    // handled below
  }

  if (
    !conversationKind ||
    !conversationId ||
    !KINDS.includes(conversationKind)
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Find the latest message in the conversation to reference
  const { data: latest } = await supabase
    .from(MSG_TABLE[conversationKind])
    .select('id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  const messageId = latest?.id ?? conversationId

  const { error } = await supabase
    .from('message_reports')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      reporter_user_id: user.id,
      message_kind: conversationKind,
      message_id: messageId,
      reason,
    } as any)

  if (error) {
    return NextResponse.json(
      { error: 'Could not submit report' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
