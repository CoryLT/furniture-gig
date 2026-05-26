import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel, claimStatusLabel, claimStatusClass } from '@/lib/utils'
import { MapPin, Calendar, Wrench, ArrowLeft, User, Pencil, Check, StickyNote } from 'lucide-react'
import OpenChatButton from '@/components/shared/OpenChatButton'
import ApplicantActions from './ApplicantActions'
import GigReferenceImages from '@/components/shared/GigReferenceImages'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import type { GigImageRow } from '@/types/database'

// Always fetch fresh — never cache this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

type WorkerProfile = {
  first_name: string
  last_name: string
  full_name: string | null
  city: string
  state: string
  username: string | null
  bio: string
  skills: string[]
  avatar_url: string | null
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
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

  // Load this gig's checklist items. We show these on the detail page so
  // the flipper can see what they asked for at a glance.
  const { data: checklistRaw } = await supabase
    .from('gig_checklist_items')
    .select('id, title, description, required, sort_order')
    .eq('gig_id', gig.id)
    .order('sort_order')

  type ChecklistItem = {
    id: string
    title: string
    description: string | null
    required: boolean
    sort_order: number
  }
  const checklist = (checklistRaw ?? []) as ChecklistItem[]

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
        .select('user_id, first_name, last_name, full_name, city, state, username, bio, skills, avatar_url, stripe_charges_enabled, stripe_payouts_enabled')
        .in('user_id', workerIds)
    : { data: [] }

  const profileByUserId = new Map<string, WorkerProfile>()
  for (const p of (profilesRaw ?? []) as any[]) {
    profileByUserId.set(p.user_id, {
      first_name: p.first_name,
      last_name: p.last_name,
      full_name: p.full_name ?? null,
      city: p.city,
      state: p.state,
      username: p.username,
      bio: p.bio,
      skills: p.skills,
      avatar_url: p.avatar_url ?? null,
      stripe_charges_enabled: p.stripe_charges_enabled === true,
      stripe_payouts_enabled: p.stripe_payouts_enabled === true,
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

  // If there's a worker actively working (or one who has submitted for
  // review), load their per-item completion progress so we can mark off
  // the checklist with ✓s and surface any notes they left.
  // We prefer submitted-for-review if both exist (rare), since that's the
  // claim the flipper is most likely interested in.
  const workingClaim = submittedClaim ?? activeClaim
  type CompletionRow = {
    checklist_item_id: string
    completed: boolean
    notes: string | null
  }
  const completionMap = new Map<string, CompletionRow>()
  if (workingClaim && checklist.length > 0) {
    const checklistIds = checklist.map((c) => c.id)
    const { data: completionsRaw } = await supabase
      .from('gig_task_completions')
      .select('checklist_item_id, completed, notes')
      .eq('worker_user_id', workingClaim.worker_user_id)
      .in('checklist_item_id', checklistIds)

    for (const row of (completionsRaw ?? []) as any[]) {
      completionMap.set(row.checklist_item_id, {
        checklist_item_id: row.checklist_item_id,
        completed: !!row.completed,
        notes: (row.notes as string) ?? null,
      })
    }
  }
  const completedCount = checklist.filter(
    (c) => completionMap.get(c.id)?.completed,
  ).length

  const renderApplicantCard = (
    claim: ClaimRow,
    showActions: boolean,
    showReviewLink: boolean = false
  ) => {
    const wp = claim.worker_profiles

    // Build the best display name from whatever we have. We try
    // full_name first (newer field), then first+last, then @username,
    // then a generic fallback. Trim to avoid lone leading/trailing
    // spaces if one of first/last is missing.
    const firstLast = wp ? `${wp.first_name ?? ''} ${wp.last_name ?? ''}`.trim() : ''
    const workerName =
      wp?.full_name?.trim() ||
      firstLast ||
      (wp?.username ? `@${wp.username}` : '') ||
      'Worker'

    // Initials for the avatar fallback (when no avatar_url is set)
    const initials = workerName
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()

    // Worker-side verified: their Stripe Connect is fully active.
    // This is the relevant trust signal here because the flipper is
    // about to send money to this person's Stripe Connect account.
    const isVerified =
      wp?.stripe_charges_enabled === true && wp?.stripe_payouts_enabled === true

    // Profile link — only meaningful if they have a username set.
    const profileHref = wp?.username ? `/u/${wp.username}` : null

    // Reusable avatar element (used both clickable and not)
    const avatarEl = wp?.avatar_url ? (
      <div className="relative w-11 h-11 rounded-full overflow-hidden bg-secondary shrink-0">
        <Image
          src={wp.avatar_url}
          alt={workerName}
          fill
          sizes="44px"
          className="object-cover"
        />
      </div>
    ) : initials ? (
      <div className="w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0 font-medium text-sm">
        {initials}
      </div>
    ) : (
      <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <User className="w-5 h-5 text-muted-foreground" />
      </div>
    )

    return (
      <div key={claim.id} className="card card-body space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {profileHref ? (
              <Link
                href={profileHref}
                target="_blank"
                className="shrink-0 hover:opacity-80 transition-opacity"
                aria-label={`View ${workerName}'s profile`}
              >
                {avatarEl}
              </Link>
            ) : (
              avatarEl
            )}
            <div className="min-w-0">
              {profileHref ? (
                <Link
                  href={profileHref}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                >
                  <span className="truncate">{workerName}</span>
                  {isVerified && <VerifiedBadge size="sm" />}
                </Link>
              ) : (
                <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className="truncate">{workerName}</span>
                  {isVerified && <VerifiedBadge size="sm" />}
                </p>
              )}
              {wp?.city && wp?.state && (
                <p className="text-xs text-muted-foreground">{wp.city}, {wp.state}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={claimStatusClass(claim.status as 'pending' | 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled')}>
              {claimStatusLabel(claim.status as 'pending' | 'active' | 'submitted_for_review' | 'approved' | 'rejected' | 'cancelled')}
            </span>
            {profileHref && (
              <Link
                href={profileHref}
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

      {/* Checklist — what you asked the worker to do.
          When a worker is mid-job or has submitted for review, we also
          show their progress (✓ checked items + any notes they left). */}
      {checklist.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between gap-3">
            <h2 className="font-sans font-semibold text-foreground">
              Checklist ({checklist.length} {checklist.length === 1 ? 'item' : 'items'})
            </h2>
            {workingClaim && (
              <span className="text-xs text-muted-foreground">
                {completedCount} of {checklist.length} done
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {checklist.map((item, i) => {
              const progress = completionMap.get(item.id)
              const isDone = !!progress?.completed
              return (
                <div key={item.id} className="px-6 py-3 flex items-start gap-3">
                  {/* Number bubble OR ✓ check when worker has completed it */}
                  {workingClaim && isDone ? (
                    <span
                      className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5"
                      aria-label="Completed"
                      title="Marked complete by worker"
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                    {workingClaim && progress?.notes && (
                      <p className="text-xs text-foreground mt-2 flex items-start gap-1.5 rounded-md bg-muted/50 px-2 py-1.5">
                        <StickyNote className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{progress.notes}</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
