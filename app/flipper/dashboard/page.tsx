import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import { getSiteUrl } from '@/lib/utils'
import FlipperGigList, { FlipperGig } from './FlipperGigList'

// Always fetch fresh — dashboard data changes constantly
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FlipperDashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Load flipper's gigs
  const { data: gigsRaw } = await supabase
    .from('gigs')
    .select('*')
    .eq('poster_user_id', user!.id)
    .order('created_at', { ascending: false })

  const gigs = (gigsRaw ?? []) as unknown as FlipperGig[]

  // Load claim counts per gig (all statuses)
  const gigIds = gigs.map((g) => g.id)
  const { data: claims } = gigIds.length > 0
    ? await supabase
        .from('gig_claims')
        .select('gig_id, status')
        .in('gig_id', gigIds)
    : { data: [] }

  // Load gig images so we can show a thumbnail per gig.
  // One batched query, then we pick the lowest sort_order image per gig.
  const { data: imagesRaw } = gigIds.length > 0
    ? await supabase
        .from('gig_images')
        .select('gig_id, file_path, sort_order')
        .in('gig_id', gigIds)
        .order('sort_order')
    : { data: [] }

  // Build a public-URL lookup, first image per gig wins (because we ordered by sort_order)
  const thumbnailByGig: Record<string, string> = {}
  for (const img of (imagesRaw ?? []) as { gig_id: string; file_path: string }[]) {
    if (!thumbnailByGig[img.gig_id]) {
      thumbnailByGig[img.gig_id] = supabase.storage
        .from('gig-images')
        .getPublicUrl(img.file_path).data.publicUrl
    }
  }

  // Total claims per gig
  const totalClaimsByGig = (claims ?? []).reduce<Record<string, number>>(
    (acc, c: any) => {
      acc[c.gig_id] = (acc[c.gig_id] ?? 0) + 1
      return acc
    },
    {}
  )

  // Pending-only claims per gig (these are the ones needing a pick)
  const pendingClaimsByGig = (claims ?? []).reduce<Record<string, number>>(
    (acc, c: any) => {
      if (c.status === 'pending') {
        acc[c.gig_id] = (acc[c.gig_id] ?? 0) + 1
      }
      return acc
    },
    {}
  )

  // Count gigs that have any pending applicants — these are the ones that
  // need the flipper to pick a worker
  const gigsNeedingReview = Object.values(pendingClaimsByGig).filter(
    (n) => n > 0
  ).length
  const totalPendingApplicants = Object.values(pendingClaimsByGig).reduce(
    (sum, n) => sum + n,
    0
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">My Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Post jobs and put your crew to work
          </p>
        </div>
        <Link
          href="/flipper/post-gig"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Post a Job
        </Link>
      </div>

      {/* Needs-review banner (only shows when there's something to act on) */}
      {gigsNeedingReview > 0 && (
        <a
          href="#your-gigs"
          className="card card-body block border-accent/40 ring-1 ring-accent/20 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {gigsNeedingReview} job{gigsNeedingReview === 1 ? '' : 's'} need
                {gigsNeedingReview === 1 ? 's' : ''} your review
              </p>
              <p className="text-sm text-muted-foreground">
                {totalPendingApplicants} pending applicant
                {totalPendingApplicants === 1 ? '' : 's'} waiting to be picked.
                Tap to see them below.
              </p>
            </div>
          </div>
        </a>
      )}

      {/* Gig list */}
      <div id="your-gigs" className="scroll-mt-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Jobs</h2>

        {gigs.length === 0 ? (
          <div className="card card-body text-center py-16 space-y-3">
            <p className="text-lg text-muted-foreground">
              You haven&apos;t posted any jobs yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Post your first job to put your crew to work.
            </p>
            <Link
              href="/flipper/post-gig"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Post your first job
            </Link>
          </div>
        ) : (
          <FlipperGigList
            gigs={gigs}
            totalClaimsByGig={totalClaimsByGig}
            pendingClaimsByGig={pendingClaimsByGig}
            thumbnailByGig={thumbnailByGig}
            siteUrl={getSiteUrl()}
          />
        )}
      </div>
    </div>
  )
}
