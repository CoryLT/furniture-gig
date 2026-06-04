import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/stripe/cancel-pick
 *
 * No-show handling. The gig poster (or admin) un-picks the worker they
 * chose and reopens the gig so someone else can apply.
 *
 * Payments are direct & off-platform now (Stripe removed, May 2026), so
 * there is no money hold to release here. Un-picking is purely:
 *   1. Verify the caller is the gig poster (or admin).
 *   2. Verify the claim is 'active' (a currently picked worker).
 *   3. Cancel the claim and reopen the gig.
 *
 * Body: { claimId: string }
 */
export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let claimId: string
  try {
    const body = await req.json()
    claimId = body?.claimId
    if (!claimId || typeof claimId !== 'string') {
      return NextResponse.json({ error: 'Missing claimId.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Load the claim.
  const { data: claim, error: claimErr } = await supabase
    .from('gig_claims')
    .select('id, gig_id, worker_user_id, status')
    .eq('id', claimId)
    .maybeSingle()
  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 })
  }

  if (claim.status !== 'active') {
    return NextResponse.json(
      {
        error: `Only a picked worker can be cancelled here (current status: ${claim.status}).`,
      },
      { status: 409 }
    )
  }

  // Load the gig + verify the caller is the poster or an admin.
  const { data: gig, error: gigErr } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by, status')
    .eq('id', claim.gig_id)
    .maybeSingle()
  if (gigErr || !gig) {
    return NextResponse.json({ error: 'Gig not found.' }, { status: 404 })
  }

  const posterId = (gig as any).poster_user_id ?? (gig as any).created_by
  let isAdmin = false
  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  isAdmin = (me as any)?.role === 'admin'

  if (user.id !== posterId && !isAdmin) {
    return NextResponse.json(
      { error: 'Only the gig poster can cancel this worker.' },
      { status: 403 }
    )
  }

  // Auth checks passed — use the admin client for the writes (bypasses RLS).
  const admin = createAdminClient()

  // Cancel the claim.
  const { error: claimUpdErr } = await admin
    .from('gig_claims')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', claim.id)
  if (claimUpdErr) {
    return NextResponse.json(
      { error: `Could not cancel the claim: ${claimUpdErr.message}` },
      { status: 500 }
    )
  }

  // Reopen the gig.
  const { error: gigUpdErr } = await admin
    .from('gigs')
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', claim.gig_id)
  if (gigUpdErr) {
    return NextResponse.json(
      {
        error: `The worker was cancelled but the gig could not be reopened: ${gigUpdErr.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'ok' })
}
