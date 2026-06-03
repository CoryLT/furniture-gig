import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/push/unsubscribe
// Body: { endpoint: string }
// Removes this device's subscription for the signed-in user.
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let endpoint: string | null = null
  try {
    endpoint = (await req.json())?.endpoint ?? null
  } catch {
    // handled below
  }
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
