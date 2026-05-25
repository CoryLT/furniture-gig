import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/support/resolve
// Body: { conversationId: string }
// Marks the conversation as resolved (user-side close).
export async function POST(req: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { conversationId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('support_conversations')
    .update({ status: 'resolved', updated_at: new Date().toISOString() } as any)
    .eq('id', body.conversationId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
