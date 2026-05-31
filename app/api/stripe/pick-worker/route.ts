import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/stripe/pick-worker
 * (Path kept for now; this no longer touches Stripe.)
 *
 * Picks a worker for a gig: marks the chosen applicant 'active' and
 * declines the rest, via the approve_applicant RPC. No payment hold —
 * FlipWork does not move the gig money. The poster pays the worker
 * directly after the work is done.
 *
 * Body: { claimId: string }
 */
export async function POST(req: Request) {
  const supabase = createClient()

  // --- Auth ---
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // --- Parse body ---
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

  // --- Load the claim ---
  const { data: claim, error: claimErr } = await supabase
    .from('gig_claims')
    .select('id, gig_id, worker_user_id, status')
    .eq('id', claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
  }

  if (claim.status !== 'pending') {
    return NextResponse.json(
      {
        error:
          claim.status === 'active'
            ? 'This applicant has already been picked.'
            : `This application is not pending (status: ${claim.status}).`,
      },
      { status: 409 }
    )
  }

  // --- Caller must be the gig's poster (or an admin) ---
  const { data: gig, error: gigErr } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by, status')
    .eq('id', claim.gig_id)
    .maybeSingle()

  if (gigErr || !gig) {
    return NextResponse.json({ error: 'Gig not found.' }, { status: 404 })
  }

  const posterId = (gig as any).poster_user_id ?? (gig as any).created_by
  if (user.id !== posterId) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if ((userRow as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'You are not the poster of this gig.' },
        { status: 403 }
      )
    }
  }

  // --- Approve this applicant; the RPC also declines the others. ---
  const { error: rpcErr } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: { message?: string } | null }>)('approve_applicant', {
    p_claim_id: claim.id,
  })

  if (rpcErr) {
    return NextResponse.json(
      { error: 'Could not pick this worker.', detail: rpcErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ status: 'ok' })
}
