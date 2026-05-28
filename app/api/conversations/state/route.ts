import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/conversations/state
// Body: {
//   conversationKind: 'gig' | 'listing' | 'user',
//   conversationId: string,
//   action: 'archive' | 'unarchive' | 'delete' | 'restore'
// }
// Returns: { ok: true }
//
// Sets per-user state on a conversation. Does not touch the other
// participant's view, and never deletes any messages.
const KINDS = ['gig', 'listing', 'user']
const ACTIONS = ['archive', 'unarchive', 'delete', 'restore']

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
  let action: string | null = null
  try {
    const body = await req.json()
    conversationKind = body?.conversationKind ?? null
    conversationId = body?.conversationId ?? null
    action = body?.action ?? null
  } catch {
    // handled below
  }

  if (
    !conversationKind ||
    !conversationId ||
    !action ||
    !KINDS.includes(conversationKind) ||
    !ACTIONS.includes(action)
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Figure out the new state fields based on the action
  const patch: {
    archived_at?: string | null
    deleted_at?: string | null
  } = {}
  if (action === 'archive') patch.archived_at = now
  if (action === 'unarchive') patch.archived_at = null
  if (action === 'delete') patch.deleted_at = now
  if (action === 'restore') patch.deleted_at = null

  // Upsert the per-user state row
  const { error } = await supabase
    .from('conversation_user_state')
    .upsert(
      {
        user_id: user.id,
        conversation_kind: conversationKind,
        conversation_id: conversationId,
        ...patch,
        updated_at: now,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { onConflict: 'user_id,conversation_kind,conversation_id' }
    )

  if (error) {
    return NextResponse.json(
      { error: 'Could not update conversation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
