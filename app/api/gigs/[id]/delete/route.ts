// ============================================================
// POST /api/gigs/[id]/delete
// ============================================================
// HARD-deletes a gig and (via cascade FKs) everything attached to
// it: claims, checklist items, task completions, photo uploads,
// gig images, payout records, conversations, messages.
//
// Guard rails:
//   1. Caller must be the gig poster (or an admin).
//   2. If ANY payout_records row for this gig has an active or
//      already-settled Stripe payment (authorized / captured /
//      transferred / refunded / failed), we REFUSE. Those rows
//      either hold real money or document a real money event
//      and must not be silently erased. The user is told to
//      archive instead.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Statuses on payout_records.payment_status that mean "real money has
// been touched" and therefore block deletion.
const BLOCKING_PAYMENT_STATUSES = [
  'authorized',
  'captured',
  'transferred',
  'refunded',
  'failed',
]

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // 1. Must be logged in.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Load the gig with both possible owner columns.
  const { data: gig, error: gigError } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by, title')
    .eq('id', params.id)
    .single<{
      id: string
      poster_user_id: string | null
      created_by: string | null
      title: string
    }>()

  if (gigError || !gig) {
    return NextResponse.json({ error: 'Gig not found' }, { status: 404 })
  }

  // 3. Auth check: owner or admin.
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  const ownerId = gig.poster_user_id ?? gig.created_by
  const isOwner = ownerId === user.id
  const isAdmin = userRow?.role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Money guard: refuse if any payout record on this gig has
  // touched Stripe money. Archived is the right tool for those.
  const { data: payouts } = await supabase
    .from('payout_records')
    .select('id, payment_status, payout_status')
    .eq('gig_id', params.id)

  if (payouts && payouts.length > 0) {
    const blocking = (payouts as Array<{
      payment_status: string | null
      payout_status: string | null
    }>).find(
      (p) =>
        (p.payment_status && BLOCKING_PAYMENT_STATUSES.includes(p.payment_status)) ||
        p.payout_status === 'paid' ||
        p.payout_status === 'pending'
    )
    if (blocking) {
      return NextResponse.json(
        {
          error:
            'This gig has a payment on file. Archive it instead so the money record is kept.',
        },
        { status: 409 }
      )
    }
  }

  // 5. Hard delete. Cascade FKs handle everything attached.
  const { error: deleteError } = await supabase
    .from('gigs')
    .delete()
    .eq('id', params.id)

  if (deleteError) {
    console.error('[delete-gig] delete error:', deleteError)
    return NextResponse.json(
      { error: deleteError.message || 'Could not delete gig.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
