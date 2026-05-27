import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Plus, Users, DollarSign, Briefcase, Clock, AlertCircle } from 'lucide-react'
import FlipperGigList, { FlipperGig } from './FlipperGigList'
import FilterTile from './FilterTile'

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

  // Load payout records for this flipper's gigs. We use this for
  // the "Paid Out" tile so the number matches what /admin/payouts
  // shows (which is the actual money moved by Stripe, NOT just the
  // count of gigs marked completed).
  const { data: payoutsRaw } = gigIds.length > 0
    ? await supabase
        .from('payout_records')
        .select('gig_id, amount, payout_status')
        .in('gig_id', gigIds)
    : { data: [] }
  const payouts = (payoutsRaw ?? []) as { gig_id: string; amount: number; payout_status: string }[]

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

  // Stats — exclude archived and drafts from total count.
  // Drafts are unfinished gigs that aren't visible to workers; archived
  // are hidden by default.
  const totalGigs = gigs.filter(
    (g) => g.status !== 'archived' && g.status !== 'draft',
  ).length
  // 'Active' means actively being worked on — matches the 'in_progress'
  // filter on the gig list below so the tile count and the filtered
  // list are guaranteed to agree.
  const activeGigs = gigs.filter((g) =>
    ['claimed', 'in_review'].includes(g.status)
  ).length
  const completedGigs = gigs.filter((g) => g.status === 'completed').length
  // Total paid out = sum of payout_records rows in 'paid' status for this
  // flipper's gigs. Same source as /admin/payouts so the dashboard tile
  // and the payouts page never disagree.
  const totalPayout = payouts
    .filter((p) => p.payout_status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0)

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
          <h1 className="text-3xl text-foreground">My Posted Gigs</h1>
          <p className="text-muted-foreground mt-1">
            Manage gigs you&apos;ve posted
          </p>
        </div>
        <Link
          href="/flipper/post-gig"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Post a Gig
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
                {gigsNeedingReview} gig{gigsNeedingReview === 1 ? '' : 's'} need
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

      {/* Stats — 5 tiles, all clickable.
          The first 4 set a hash like #filter=completed which the
          FlipperGigList client component reads to scope the list.
          The 5th (Paid Out) links to the admin payouts page. */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <FilterTile href="#filter=all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">
                {totalGigs}
              </p>
              <p className="text-xs text-muted-foreground">Total Gigs</p>
            </div>
          </div>
        </FilterTile>
        <FilterTile href="#filter=in_progress">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">
                {activeGigs}
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        </FilterTile>
        <FilterTile
          href="#filter=needs_review"
          className={
            gigsNeedingReview > 0
              ? 'border-accent/40 ring-1 ring-accent/20'
              : ''
          }
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">
                {gigsNeedingReview}
              </p>
              <p className="text-xs text-muted-foreground">
                Gig{gigsNeedingReview === 1 ? '' : 's'} with applicants
              </p>
            </div>
          </div>
        </FilterTile>
        <FilterTile href="#filter=completed">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">
                {completedGigs}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </FilterTile>
        <FilterTile href="/admin/payouts">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">
                {formatCurrency(totalPayout)}
              </p>
              <p className="text-xs text-muted-foreground">Paid Out</p>
            </div>
          </div>
        </FilterTile>
      </div>

      {/* Gig list */}
      <div id="your-gigs" className="scroll-mt-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Gigs</h2>

        {gigs.length === 0 ? (
          <div className="card card-body text-center py-16 space-y-3">
            <p className="text-lg text-muted-foreground">
              You haven&apos;t posted any gigs yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Post your first gig to find local workers.
            </p>
            <Link
              href="/flipper/post-gig"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Post your first gig
            </Link>
          </div>
        ) : (
          <FlipperGigList
            gigs={gigs}
            totalClaimsByGig={totalClaimsByGig}
            pendingClaimsByGig={pendingClaimsByGig}
            thumbnailByGig={thumbnailByGig}
          />
        )}
      </div>
    </div>
  )
}
