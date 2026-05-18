import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/messages/start
// Body: { gigId: string }
// Returns: { conversationId: string }
//
// Behavior:
//  - If a conversation already exists for this gig, return it (after verifying
//    the current user is one of the two participants).
//  - If not, look up the gig's poster (flipper) and the active claim's worker,
//    and create the conversation. Both sides can hit this endpoint.
export async function POST(req: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let gigId: string | null = null
  try {
    const body = await req.json()
    gigId = body?.gigId ?? null
  } catch {
    // ignore
  }
  if (!gigId) {
    return NextResponse.json({ error: 'Missing gigId' }, { status: 400 })
  }

  // 1) Does a conversation already exist for this gig?
  const { data: existing } = await supabase
    .from('gig_conversations')
    .select('id, flipper_user_id, worker_user_id')
    .eq('gig_id', gigId)
    .maybeSingle<{ id: string; flipper_user_id: string; worker_user_id: string }>()

  if (existing) {
    if (existing.flipper_user_id !== user.id && existing.worker_user_id !== user.id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }
    return NextResponse.json({ conversationId: existing.id })
  }

  // 2) Create one. Look up the gig poster and the active claim.
  const { data: gig } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by')
    .eq('id', gigId)
    .single<{ id: string; poster_user_id: string | null; created_by: string | null }>()

  if (!gig) {
    return NextResponse.json({ error: 'Gig not found' }, { status: 404 })
  }

  const flipperUserId = gig.poster_user_id ?? gig.created_by
  if (!flipperUserId) {
    return NextResponse.json({ error: 'Gig has no owner' }, { status: 400 })
  }

  const { data: claim } = await supabase
    .from('gig_claims')
    .select('worker_user_id')
    .eq('gig_id', gigId)
    .eq('status', 'active')
    .maybeSingle<{ worker_user_id: string }>()

  if (!claim) {
    return NextResponse.json({ error: 'Gig is not currently claimed' }, { status: 400 })
  }

  // Caller must be one of the two participants
  if (user.id !== flipperUserId && user.id !== claim.worker_user_id) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const { data: created, error: insertError } = await supabase
    .from('gig_conversations')
    // @ts-expect-error supabase insert generics
    .insert({
      gig_id: gigId,
      flipper_user_id: flipperUserId,
      worker_user_id: claim.worker_user_id,
    })
    .select('id')
    .single<{ id: string }>()

  if (insertError || !created) {
    // Race: another request may have created it. Try fetching again.
    const { data: retry } = await supabase
      .from('gig_conversations')
      .select('id')
      .eq('gig_id', gigId)
      .maybeSingle<{ id: string }>()
    if (retry) {
      return NextResponse.json({ conversationId: retry.id })
    }
    return NextResponse.json({ error: 'Could not start conversation' }, { status: 500 })
  }

  return NextResponse.json({ conversationId: created.id })
}
