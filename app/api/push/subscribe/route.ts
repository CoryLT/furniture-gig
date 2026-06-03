import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/push/subscribe
// Body: { subscription: PushSubscriptionJSON, userAgent?: string }
// Saves (or refreshes) this device's push subscription for the signed-in user.
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sub: any = null
  let userAgent: string | null = null
  try {
    const body = await req.json()
    sub = body?.subscription ?? null
    userAgent = body?.userAgent ?? null
  } catch {
    // handled below
  }

  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const auth: string | undefined = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
