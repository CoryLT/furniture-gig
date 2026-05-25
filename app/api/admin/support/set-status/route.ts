import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/admin/support/set-status
// Body: { conversationId, status: 'active' | 'resolved' }
// Admin only.
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((userRow as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { conversationId?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.conversationId || !['active', 'resolved'].includes(body.status || '')) {
    return NextResponse.json({ error: 'Bad input' }, { status: 400 })
  }

  const { error } = await supabase
    .from('support_conversations')
    .update({ status: body.status, updated_at: new Date().toISOString() } as any)
    .eq('id', body.conversationId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
