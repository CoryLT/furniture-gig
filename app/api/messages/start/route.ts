import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/messages/start
// Body: { gigId: string, workerUserId?: string }
// Returns: { conversationId: string }
//
// Behavior:
//  - Determine the (gig, worker) pair:
//      • If caller is the flipper, workerUserId MUST be provided.
//      • If caller is a worker, workerUserId defaults to the caller.
//  - If a conversation exists for that (gig, worker), return it.
//  - Otherwise, create it (the DB trigger usually handles this on apply,
//    but we still create it here as a fallback).
export async function POST(req: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let gigId: string | null = null
  let workerUserIdFromBody: string | null = null
  try {
    const body = await req.json()
    gigId = body?.gigId ?? null
    workerUserIdFromBody = body?.workerUserId ?? null
  } catch {
    // ignore
  }
  if (!gigId) {
    return NextResponse.json({ error: 'Missing gigId' }, { status: 400 })
  }

  // Look up the gig poster
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

  const isFlipper = user.id === flipperUserId

  // Decide which worker this conversation is with
  let workerUserId: string | null
  if (isFlipper) {
    if (!workerUserIdFromBody) {
      return NextResponse.json({ error: 'Missing workerUserId' }, { status: 400 })
    }
    workerUserId = workerUserIdFromBody
  } else {
    workerUserId = user.id
  }

  // 1) Does a conversation already exist for this (gig, worker)?
  const { data: existing } = await supabase
    .from('gig_conversations')
    .select('id, flipper_user_id, worker_user_id')
    .eq('gig_id', gigId)
    .eq('worker_user_id', workerUserId)
    .maybeSingle<{ id: string; flipper_user_id: string; worker_user_id: string }>()

  if (existing) {
    if (existing.flipper_user_id !== user.id && existing.worker_user_id !== user.id) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }
    return NextResponse.json({ conversationId: existing.id })
  }

  // 2) Verify the worker has an application/claim on this gig before creating
  const { data: claim } = await supabase
    .from('gig_claims')
    .select('id, status')
    .eq('gig_id', gigId)
    .eq('worker_user_id', workerUserId)
    .maybeSingle<{ id: string; status: string }>()

  if (!claim) {
    return NextResponse.json(
      { error: 'No application from this worker on this gig' },
      { status: 400 }
    )
  }

  // 3) Create the conversation (fallback if the trigger didn't fire)
  const { data: created, error: insertError } = await supabase
    .from('gig_conversations')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore supabase insert generics
    .insert({
      gig_id: gigId,
      flipper_user_id: flipperUserId,
      worker_user_id: workerUserId,
    })
    .select('id')
    .single<{ id: string }>()

  if (insertError || !created) {
    // Race: another request may have created it. Try fetching again.
    const { data: retry } = await supabase
      .from('gig_conversations')
      .select('id')
      .eq('gig_id', gigId)
      .eq('worker_user_id', workerUserId)
      .maybeSingle<{ id: string }>()
    if (retry) {
      return NextResponse.json({ conversationId: retry.id })
    }
    return NextResponse.json({ error: 'Could not start conversation' }, { status: 500 })
  }

  return NextResponse.json({ conversationId: created.id })
}
