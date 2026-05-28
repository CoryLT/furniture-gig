import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/user-messages/start
// Body: { otherUserId: string }
// Returns: { conversationId: string }
//
// Behavior:
//   - Caller must be logged in.
//   - Caller must NOT be the same as otherUserId.
//   - Neither side may have blocked the other.
//   - User pair is stored canonically: user_a_id < user_b_id.
//   - If a conversation already exists for the pair, return it.
//   - Otherwise, create one.
export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let otherUserId: string | null = null
  try {
    const body = await req.json()
    otherUserId = body?.otherUserId ?? null
  } catch {
    // handled by null check below
  }
  if (!otherUserId) {
    return NextResponse.json({ error: 'Missing otherUserId' }, { status: 400 })
  }

  if (otherUserId === user.id) {
    return NextResponse.json(
      { error: "You can't message yourself." },
      { status: 400 }
    )
  }

  // Note: we don't pre-check that otherUserId exists in the users table —
  // RLS hides other users' rows from a normal caller, so that lookup would
  // wrongly fail. The foreign keys on user_conversations enforce a real
  // user ID at insert time instead.

  // Block check — either direction stops the conversation
  const { data: block } = await supabase
    .from('user_blocks')
    .select('id')
    .or(
      `and(blocker_user_id.eq.${user.id},blocked_user_id.eq.${otherUserId}),and(blocker_user_id.eq.${otherUserId},blocked_user_id.eq.${user.id})`
    )
    .maybeSingle<{ id: string }>()

  if (block) {
    return NextResponse.json(
      { error: 'You cannot message this user.' },
      { status: 403 }
    )
  }

  // Canonical ordering: a < b
  const userA = user.id < otherUserId ? user.id : otherUserId
  const userB = user.id < otherUserId ? otherUserId : user.id

  // 1) Existing conversation for this pair?
  const { data: existing } = await supabase
    .from('user_conversations')
    .select('id')
    .eq('user_a_id', userA)
    .eq('user_b_id', userB)
    .maybeSingle<{ id: string }>()

  if (existing) {
    return NextResponse.json({ conversationId: existing.id })
  }

  // 2) Create it
  const { data: created, error: insertError } = await supabase
    .from('user_conversations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      user_a_id: userA,
      user_b_id: userB,
    } as any)
    .select('id')
    .single<{ id: string }>()

  if (insertError || !created) {
    // Race: another request may have created it. Retry fetch.
    const { data: retry } = await supabase
      .from('user_conversations')
      .select('id')
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .maybeSingle<{ id: string }>()
    if (retry) {
      return NextResponse.json({ conversationId: retry.id })
    }
    return NextResponse.json(
      { error: 'Could not start conversation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ conversationId: created.id })
}
