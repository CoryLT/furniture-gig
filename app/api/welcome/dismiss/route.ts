// ============================================================
// POST /api/welcome/dismiss
// ============================================================
// Marks the current user's welcome modal as dismissed by setting
// users.dismissed_welcome_modal_at to now(). Called from the
// "Let's go!" button on the welcome modal.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('users')
    .update({ dismissed_welcome_modal_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('[welcome/dismiss] update error:', error)
    return NextResponse.json(
      { error: 'Could not save dismissal.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
