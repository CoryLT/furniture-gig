import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'

// POST /api/push/test
// Sends a test notification to the signed-in user and reports back what
// happened, so we can see exactly where push is (or isn't) working:
//   - configured: is the server set up to send (VAPID key present)?
//   - subs: how many of this user's devices are registered?
//   - sent: how many pushes the push service accepted.
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = !!process.env.VAPID_PRIVATE_KEY

  const { count } = await supabase
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const result = await sendPushToUser({
    userId: user.id,
    title: 'FlipWork test',
    body: 'If you can see this, your notifications are working.',
    url: '/home',
    tag: 'fw-test',
  })

  return NextResponse.json({
    configured,
    subs: count ?? 0,
    sent: result.sent,
  })
}
