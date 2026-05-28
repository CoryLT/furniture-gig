import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/users/block
// Body: { targetUserId: string, action: 'block' | 'unblock' }
// Returns: { ok: true }
export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let targetUserId: string | null = null
  let action: string | null = null
  try {
    const body = await req.json()
    targetUserId = body?.targetUserId ?? null
    action = body?.action ?? null
  } catch {
    // handled below
  }

  if (!targetUserId || (action !== 'block' && action !== 'unblock')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (targetUserId === user.id) {
    return NextResponse.json(
      { error: "You can't block yourself." },
      { status: 400 }
    )
  }

  if (action === 'block') {
    const { error } = await supabase
      .from('user_blocks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        {
          blocker_user_id: user.id,
          blocked_user_id: targetUserId,
        } as any,
        { onConflict: 'blocker_user_id,blocked_user_id' }
      )
    if (error) {
      return NextResponse.json({ error: 'Could not block user' }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_user_id', user.id)
      .eq('blocked_user_id', targetUserId)
    if (error) {
      return NextResponse.json(
        { error: 'Could not unblock user' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}
