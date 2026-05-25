// ============================================================
// POST   /api/follows  { followed_user_id }  -> follow that user
// DELETE /api/follows  { followed_user_id }  -> unfollow that user
// ============================================================
// Anyone-can-follow-anyone model. RLS on the follows table is
// the real safety net (you can only insert rows where you ARE
// the follower; you can only delete your own follow rows).
//
// Self-follows are blocked by a CHECK constraint at the DB level,
// but we also short-circuit here for a friendlier error.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { followed_user_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const followedUserId = body.followed_user_id
  if (!followedUserId) {
    return NextResponse.json(
      { error: 'Missing followed_user_id.' },
      { status: 400 },
    )
  }

  if (followedUserId === user.id) {
    return NextResponse.json(
      { error: "You can't follow yourself." },
      { status: 400 },
    )
  }

  const { error } = await supabase.from('follows').insert({
    follower_user_id: user.id,
    followed_user_id: followedUserId,
  } as any)

  // Unique violation just means "already following" — treat as success
  if (error && error.code !== '23505') {
    console.error('[follows POST] insert error:', error)
    return NextResponse.json(
      { error: 'Could not follow this user.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, following: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { followed_user_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const followedUserId = body.followed_user_id
  if (!followedUserId) {
    return NextResponse.json(
      { error: 'Missing followed_user_id.' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_user_id', user.id)
    .eq('followed_user_id', followedUserId)

  if (error) {
    console.error('[follows DELETE] delete error:', error)
    return NextResponse.json(
      { error: 'Could not unfollow this user.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, following: false })
}
