import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/applicant/reinstate
 *
 * Moves a past applicant (rejected or cancelled) back into the current
 * applicants list for a gig, so the poster can pick them. Only allowed
 * when the gig is open and nobody is currently picked.
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
    return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 })
  }

  if (claim.status !== 'rejected' && claim.status !== 'cancelled') {
    return NextResponse.json(
      {
        error: `Only a past applicant can be added back (current status: ${claim.status}).`,
      },
      { status: 409 }
    )
  }

  // Load gig + verify caller is poster or admin.
  const { data: gig, error: gigErr } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by, status')
    .eq('id', claim.gig_id)
    .maybeSingle()
  if (gigErr || !gig) {
    return NextResponse.json({ error: 'Gig not found.' }, { status: 404 })
  }

  const posterId = (gig as any).poster_user_id ?? (gig as any).created_by
  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const isAdmin = (me as any)?.role === 'admin'
  if (user.id !== posterId && !isAdmin) {
    return NextResponse.json(
      { error: 'Only the gig poster can add applicants back.' },
      { status: 403 }
    )
  }

  if ((gig as any).status !== 'open') {
    return NextResponse.json(
      { error: 'You can only add applicants back while the gig is open.' },
      { status: 409 }
    )
  }

  const admin = createAdminClient()

  // Don't reinstate if a worker is already picked for this gig.
  const { data: active } = await admin
    .from('gig_claims')
    .select('id')
    .eq('gig_id', claim.gig_id)
    .eq('status', 'active')
    .maybeSingle()
  if (active) {
    return NextResponse.json(
      { error: 'A worker is already picked for this gig.' },
      { status: 409 }
    )
  }

  const { error: updErr } = await admin
    .from('gig_claims')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', claim.id)
  if (updErr) {
    return NextResponse.json(
      { error: `Could not add the applicant back: ${updErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'ok' })
}
