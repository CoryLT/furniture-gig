import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/support/conversation/[id]
// Returns conversation metadata + all messages.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: convo, error: convoErr } = await supabase
    .from('support_conversations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (convoErr || !convo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // RLS already restricts to the user's own conversations or admin.
  // No extra check needed.

  const { data: messages } = await supabase
    .from('support_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ conversation: convo, messages: messages || [] })
}
