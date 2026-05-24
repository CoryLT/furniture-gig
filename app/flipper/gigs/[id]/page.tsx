import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel, claimStatusLabel, claimStatusClass } from '@/lib/utils'
import { MapPin, Calendar, Wrench, ArrowLeft, User, Pencil } from 'lucide-react'
import OpenChatButton from '@/components/shared/OpenChatButton'
import ApplicantActions from './ApplicantActions'
import GigReferenceImages from '@/components/shared/GigReferenceImages'
import type { GigImageRow } from '@/types/database'

// Always fetch fresh — never cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

type WorkerProfile = {
  first_name: string
  last_name: string
  city: string
  state: string
  username: string | null
  bio: string
  skills: string[]
}

type ClaimRow = {
  id: string
  gig_id: string
  worker_user_id: string
  status: string
  claimed_at: string
  updated_at: string
  worker_profiles: WorkerProfile | null
}

export default async function FlipperGigDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: gig } = await supabase
    .from('gigs')
    .select('*')
    .eq('id', params.id)
    .eq('poster_user_id', user!.id)
    .single()

  if (!gig) notFound()

  // Load reference images for this gig (same data as the worker sees)
  const { data: imagesData } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const images = (imagesData ?? []) as GigImageRow[]

  // Load claims (no join — we fetch worker profiles separately to avoid
  // any silent embed-join failures from RLS)
  const { data: claimsRaw } = await supabase
    .from('gig_claims')
    .select('*')
    .eq('gig_id', gig.id)
    .order('claimed_at', { ascending: false })

  // Pull all the worker profiles for those claims in one go
  const workerIds = (claimsRaw ?? []).map((c: any) => c.worker_user_id)
  const { data: profilesRaw } = workerIds.length > 0
    ? await supabase
        .from('worker_profiles')
        .select('user_id, first_name, last_name, city, state, username, bio, skills')
        .in('user_id', workerIds)
    : { data: [] }

  const profileByUserId = new Map<string, WorkerProfile>()
  for (const p of (profilesRaw ?? []) as any[]) {
    profileByUserId.set(p.user_id, {
      first_name: p.first_name,
      last_name: p.last_name,
      city: p.city,
      state: p.state,
      username: p.username,
      bio: p.bio,
      skills: p.skills,
    })
  }

  // Stitch profiles onto claims
  const claims = ((claimsRaw ?? []) as any[]).map((c) => ({
    ...c,
    worker_profiles: profileByUserId.get(c.worker_user_id) ?? null,
  })) as ClaimRow[]

  // Split by status
  const pendingClaims = claims.filter((c) => c.status === 'pending')
  const activeClaim = claims.find((c) => c.status === 'active') ?? null
  // Submitted for review = worker is done, flipper needs to approve/reject.
  // Gets its own prominent section, NOT grouped with rejected/cancelled.
  const submittedClaim =
    claims.find((c) => c.status === 'submitted_for_review') ?? null
  const otherClaims = claims.filter(
    (c) =>
      !['pending', 'active', 'submitted_for_review'].includes(c.status)
  )

  const renderApplicantCard = (
    claim: ClaimRow,
    showActions: boolean,
    showReviewLink: boolean = false
  ) => {
    const wp = claim.worker_profiles
    const workerName = wp ? `${wp.first_name} ${wp.last_name}`.trim() || 'Worker' : 'Worker'

    return (
      <div key={claim.id} className="card card-body space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{workerName}</p>
              {wp?.city && wp?.state && (
                <p className="text-xs text-muted-foreground">{wp.city}, {wp.state}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={claimStatusClass(claim.status as 'pending' | 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled')}>
              {claimStatusLabel(claim.status as 'pending' | 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled')}
            </span>
            {wp?.username && (
              <Link
                href={`/u/${wp.username}`}
                className="text-xs text-accent hover:underline"
                target="_blank"
              >
                View profile
              </Link>
            )}
          </div>
        </div>

        {wp?.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{wp.bio}</p>
        )}

        {wp?.skills && wp.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {wp.skills.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {claim.status === 'pending' ? 'Applied' : claim.status === 'active' ? 'Picked' : 'Updated'}{' '}
          {formatDate(claim.updated_at || claim.claimed_at)}
        </p>

        <div className="pt-1 flex flex-wrap items-center gap-2">
          <OpenChatButton gigId={gig.id} otherUserId={claim.worker_user_id} label="Message" />
          {showActions && (
            <ApplicantActions claimId={claim.id} workerName={workerName} />
          )}
          {showReviewLink && (
            <Link
              href={`/flipper/review/${claim.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Review work
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/flipper/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
        <Link
          href={`/flipper/gigs/${gig.id}/edit`}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit gig
        </Link>
      </div>

      {/* Gig header */}
      <div className="card card-body space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl text-foreground">{gig.title}</h1>
            <p className="text-sm text-muted-foreground font-mono capitalize mt-0.5">{gig.furniture_type}</p>
          </div>
          <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {(gig.city || gig.location_text) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {gig.city && gig.state ? `${gig.city}, ${gig.state}` : gig.location_text}
            </span>
          )}
          {gig.due_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Due {formatDate(gig.due_date)}
            </span>
          )}
          {gig.required_skills.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Wrench className="w-4 h-4" />
              {gig.required_skills.join(', ')}
            </span>
          )}
        </div>

        <div className="font-mono text-xl font-semibold text-foreground">
          {formatCurrency(gig.pay_amount)}
        </div>

        {gig.summary && <p className="text-muted-foreground">{gig.summary}</p>}
        {gig.description && (
          <div className="prose prose-sm max-w-none text-muted-foreground border-t border-border pt-4">
            <p className="whitespace-pre-wrap">{gig.description}</p>
          </div>
        )}
      </div>

      {/* Reference images you uploaded */}
      <GigReferenceImages images={images} />

      {/* Submitted for review (worker is done, flipper needs to approve) */}
      {submittedClaim && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Work submitted for review
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            The worker has finished. Review the checklist and proof photos, then
            approve to release payment or send back for revision.
          </p>
          {renderApplicantCard(submittedClaim, false, true)}
        </div>
      )}

      {/* Picked worker (if any, and not in review) */}
      {activeClaim && !submittedClaim && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Picked worker</h2>
          {renderApplicantCard(activeClaim, false)}
        </div>
      )}

      {/* Pending applicants (only show when no worker is picked yet) */}
      {!activeClaim && !submittedClaim && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {pendingClaims.length} {pendingClaims.length === 1 ? 'Applicant' : 'Applicants'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Review applicants below. You can message them before picking one. Once you pick someone,
            the rest are automatically rejected.
          </p>

          {pendingClaims.length === 0 ? (
            <div className="card card-body text-center py-12">
              <p className="text-muted-foreground">No workers have applied to this gig yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingClaims.map((claim) => renderApplicantCard(claim, true))}
            </div>
          )}
        </div>
      )}

      {/* Past applicants (rejected/cancelled/approved) */}
      {otherClaims.length > 0 && (
        <details className="card card-body">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Past applicants ({otherClaims.length})
          </summary>
          <div className="space-y-3 mt-4">
            {otherClaims.map((claim) => renderApplicantCard(claim, false))}
          </div>
        </details>
      )}
    </div>
  )
}
