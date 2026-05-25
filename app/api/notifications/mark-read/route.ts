// ============================================================
// POST /api/notifications/mark-read
//   body: { id?: string }   -> mark that one read
//   body: { all: true }     -> mark all read
// ============================================================
// Auth required. RLS already restricts updates to your own rows;
// we still filter by recipient_user_id as a belt-and-suspenders.
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

  let body: { id?: string; all?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()

  if (body.all) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso } as any)
      .eq('recipient_user_id', user.id)
      .is('read_at', null)

    if (error) {
      console.error('[notifications/mark-read all] error:', error)
      return NextResponse.json(
        { error: 'Could not mark all as read.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso } as any)
      .eq('id', body.id)
      .eq('recipient_user_id', user.id)

    if (error) {
      console.error('[notifications/mark-read one] error:', error)
      return NextResponse.json(
        { error: 'Could not mark as read.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { error: 'Provide either id or all=true.' },
    { status: 400 },
  )
}
