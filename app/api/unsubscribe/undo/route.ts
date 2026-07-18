// ============================================================
// POST /api/unsubscribe/undo
// ============================================================
// Powers the "unsubscribed by accident? Undo" button on the
// /unsubscribe/[token] confirmation page. Flips email_marketing
// back to true. Token-scoped, no auth required.
// ============================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let token = ''
  try {
    const body = await req.json()
    token = String(body?.token || '').trim()
  } catch {
    // fall through — empty token 400s below
  }
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('notification_preferences')
    .select('user_id')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (!row) {
    // Don't reveal whether the token was valid or not.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('notification_preferences')
    .update({ email_marketing: true })
    .eq('unsubscribe_token', token)

  if (error) {
    return NextResponse.json({ error: 'Failed to re-subscribe' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
