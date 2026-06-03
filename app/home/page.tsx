import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/shared/Nav'
import ActivityChart from '@/components/home/ActivityChart'
import { WelcomeModal } from '@/components/shared/WelcomeModal'
import { lastNDays, isoDayOf, buildBuckets } from '@/lib/home-dashboard'
import { formatCurrency, formatDate } from '@/lib/utils'
import BusinessSetupCard from './BusinessSetupCard'
import EnableNotificationsButton from '@/components/notifications/EnableNotificationsButton'
import AddToHomeScreenPrompt from '@/components/notifications/AddToHomeScreenPrompt'
import UnreadMessagesCard from '@/components/home/UnreadMessagesCard'
import {
  DollarSign,
  Briefcase,
  Plus,
  Search,
  AlertCircle,
  ClipboardCheck,
  MessageSquare,
  Wrench,
  Sparkles,
  ArrowRight,
  Trophy,
  Store,
  Tag,
  Package,
  Hammer,
  Users,
  User,
} from 'lucide-react'

// Always fetch fresh — this page IS about live data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Admin: punt to admin dashboard, they don't need this view
  const { data: userRow } = await supabase
    .from('users')
    .select('role, dismissed_welcome_modal_at')
    .eq('id', user.id)
    .maybeSingle()
  if ((userRow as any)?.role === 'admin') redirect('/admin')

  // Show the welcome modal to anyone who hasn't dismissed it yet
  const showWelcomeModal =
    (userRow as any)?.dismissed_welcome_modal_at == null

  // ============================================================
  // Profiles (for greeting + nav)
  // ============================================================
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('first_name, last_name, username')
    .eq('user_id', user.id)
    .maybeSingle()

  const flipperProfile = (await supabase
    .from('flipper_profiles')
    .select('business_name, username')
    .eq('user_id', user.id)
    .maybeSingle()).data

  const { data: businessProfile } = await supabase
    .from('business_profiles')
    .select(
      'business_name, structure, business_state, ein, bank_name, bookkeeping_tool, contractor_paperwork_ready'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  const publicUsername =
    (workerProfile as any)?.username || (flipperProfile as any)?.username || null

  const firstName =
    (workerProfile as any)?.first_name ||
    (flipperProfile as any)?.business_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'there'

  const navUsername =
    (workerProfile as any)?.username ||
    (flipperProfile as any)?.username ||
    undefined

  const navName =
    (workerProfile as any)?.first_name ||
    (flipperProfile as any)?.business_name ||
    user.email ||
    ''

  // ============================================================
  // Payouts — both directions
  // ============================================================
  const { data: payoutsAsWorker } = await supabase
    .from('payout_records')
    .select('amount, payout_status, payout_date, created_at, gig_id')
    .eq('worker_user_id', user.id)

  const { data: payoutsAsFlipper } = await supabase
    .from('payout_records')
    .select('amount, payout_status, payout_date, created_at, gig_id')
    .eq('flipper_user_id', user.id)

  // Lifetime earned: paid payouts where user is the worker
  const totalEarned = (payoutsAsWorker ?? [])
    .filter((p: any) => p.payout_status === 'paid')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  // Lifetime invested: paid payouts where user is the flipper
  const totalInvested = (payoutsAsFlipper ?? [])
    .filter((p: any) => p.payout_status === 'paid')
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  // ============================================================
  // Gigs completed (both roles combined)
  // ============================================================
  // As a worker: count approved claims
  const { count: approvedClaimsCount } = await supabase
    .from('gig_claims')
    .select('id', { count: 'exact', head: true })
    .eq('worker_user_id', user.id)
    .eq('status', 'approved')

  // As a flipper: count gigs they posted that are 'completed'
  const { count: completedPostedGigsCount } = await supabase
    .from('gigs')
    .select('id', { count: 'exact', head: true })
    .eq('poster_user_id', user.id)
    .eq('status', 'completed')

  const gigsCompletedTotal =
    (approvedClaimsCount ?? 0) + (completedPostedGigsCount ?? 0)

  // ============================================================
  // Active counts (for hero tile)
  // ============================================================
  // Active as worker: claims in 'active' or 'submitted_for_review' status
  const { count: workerActiveCount } = await supabase
    .from('gig_claims')
    .select('id', { count: 'exact', head: true })
    .eq('worker_user_id', user.id)
    .in('status', ['active', 'submitted_for_review'])

  // Active as flipper: own gigs in open / claimed / in_review
  const { count: flipperActiveCount } = await supabase
    .from('gigs')
    .select('id', { count: 'exact', head: true })
    .eq('poster_user_id', user.id)
    .in('status', ['open', 'claimed', 'in_review'])

  const activeTotal =
    (workerActiveCount ?? 0) + (flipperActiveCount ?? 0)

  // ============================================================
  // 30-day activity chart
  // ============================================================
  const thirtyDayCutoff = new Date()
  thirtyDayCutoff.setDate(thirtyDayCutoff.getDate() - 30)
  const cutoffISO = thirtyDayCutoff.toISOString()

  const earnedDeltas = (payoutsAsWorker ?? [])
    .filter((p: any) => {
      if (p.payout_status !== 'paid') return false
      const when = p.payout_date || p.created_at
      return when && when >= cutoffISO
    })
    .map((p: any) => ({
      date: isoDayOf(p.payout_date || p.created_at),
      earned: Number(p.amount || 0),
    }))

  const investedDeltas = (payoutsAsFlipper ?? [])
    .filter((p: any) => {
      if (p.payout_status !== 'paid') return false
      const when = p.payout_date || p.created_at
      return when && when >= cutoffISO
    })
    .map((p: any) => ({
      date: isoDayOf(p.payout_date || p.created_at),
      invested: Number(p.amount || 0),
    }))

  const chartData = buildBuckets(lastNDays(30), [
    ...earnedDeltas,
    ...investedDeltas,
  ])

  // ============================================================
  // ACTION SECTION: Needs your review (as a flipper)
  // ============================================================
  // Gigs you posted that have at least one claim in submitted_for_review
  const { data: myFlipperGigsForReview } = await supabase
    .from('gigs')
    .select('id, title, slug')
    .eq('poster_user_id', user.id)

  const myFlipperGigIds = (myFlipperGigsForReview ?? []).map((g: any) => g.id)

  let needsReview: { gigId: string; gigTitle: string; claimId: string }[] = []
  if (myFlipperGigIds.length > 0) {
    const { data: submittedClaims } = await supabase
      .from('gig_claims')
      .select('id, gig_id')
      .in('gig_id', myFlipperGigIds)
      .eq('status', 'submitted_for_review')

    const titleByGigId = new Map(
      (myFlipperGigsForReview ?? []).map((g: any) => [g.id, g.title])
    )
    needsReview = (submittedClaims ?? []).map((c: any) => ({
      gigId: c.gig_id,
      gigTitle: titleByGigId.get(c.gig_id) || 'Untitled gig',
      claimId: c.id,
    }))
  }

  // ============================================================
  // ACTION SECTION: Pending applicants (as a flipper)
  // ============================================================
  let pendingApplicants: {
    gigId: string
    gigTitle: string
    count: number
  }[] = []
  if (myFlipperGigIds.length > 0) {
    const { data: pendingClaims } = await supabase
      .from('gig_claims')
      .select('gig_id')
      .in('gig_id', myFlipperGigIds)
      .eq('status', 'pending')

    const titleByGigId = new Map(
      (myFlipperGigsForReview ?? []).map((g: any) => [g.id, g.title])
    )
    const countsByGig = new Map<string, number>()
    for (const c of pendingClaims ?? []) {
      const gigId = (c as any).gig_id as string
      countsByGig.set(gigId, (countsByGig.get(gigId) ?? 0) + 1)
    }
    pendingApplicants = Array.from(countsByGig.entries()).map(
      ([gigId, count]) => ({
        gigId,
        gigTitle: titleByGigId.get(gigId) || 'Untitled gig',
        count,
      })
    )
  }

  // ============================================================
  // Unread messages are shown by the live <UnreadMessagesCard /> (client-side),
  // so no server-side unread count is computed here anymore.

  // ============================================================
  // ACTION SECTION: Work in progress (as a worker)
  // ============================================================
  const { data: myActiveClaims } = await supabase
    .from('gig_claims')
    .select('id, gig_id, status, claimed_at, created_at')
    .eq('worker_user_id', user.id)
    .in('status', ['active', 'submitted_for_review'])
    .order('created_at', { ascending: false })
    .limit(5)

  let workInProgress: {
    claimId: string
    gigTitle: string
    status: string
  }[] = []
  if ((myActiveClaims ?? []).length > 0) {
    const gigIds = (myActiveClaims ?? []).map((c: any) => c.gig_id)
    const { data: workerGigs } = await supabase
      .from('gigs')
      .select('id, title')
      .in('id', gigIds)
    const titleById = new Map(
      (workerGigs ?? []).map((g: any) => [g.id, g.title])
    )
    workInProgress = (myActiveClaims ?? []).map((c: any) => ({
      claimId: c.id,
      gigTitle: titleById.get(c.gig_id) || 'Untitled gig',
      status: c.status,
    }))
  }

  // ============================================================
  // YOU VS COMMUNITY: simple percentile callouts
  // ============================================================
  // Only show if user has *some* activity
  const userHasActivity = gigsCompletedTotal > 0 || totalEarned > 0 || totalInvested > 0

  let percentileEarnings: number | null = null
  let percentileGigsCompleted: number | null = null

  if (userHasActivity) {
    // Earnings percentile: count of distinct workers with total paid < totalEarned
    if (totalEarned > 0) {
      // Get sum of paid payouts grouped by worker
      const { data: allWorkerPayouts } = await supabase
        .from('payout_records')
        .select('worker_user_id, amount, payout_status')
        .eq('payout_status', 'paid')

      const totalsByWorker = new Map<string, number>()
      for (const p of allWorkerPayouts ?? []) {
        const wid = (p as any).worker_user_id as string
        if (!wid) continue
        totalsByWorker.set(
          wid,
          (totalsByWorker.get(wid) ?? 0) + Number((p as any).amount || 0)
        )
      }
      const totals = Array.from(totalsByWorker.values())
      if (totals.length > 1) {
        const below = totals.filter((t) => t < totalEarned).length
        percentileEarnings = Math.round((below / totals.length) * 100)
      }
    }

    // Gigs-completed percentile (combined count, vs all approved-claim counts)
    if (gigsCompletedTotal > 0) {
      const { data: allApproved } = await supabase
        .from('gig_claims')
        .select('worker_user_id')
        .eq('status', 'approved')

      const countsByWorker = new Map<string, number>()
      for (const c of allApproved ?? []) {
        const wid = (c as any).worker_user_id as string
        if (!wid) continue
        countsByWorker.set(wid, (countsByWorker.get(wid) ?? 0) + 1)
      }
      const counts = Array.from(countsByWorker.values())
      if (counts.length > 1) {
        const below = counts.filter((c) => c < gigsCompletedTotal).length
        percentileGigsCompleted = Math.round((below / counts.length) * 100)
      }
    }
  }

  // ============================================================
  // RECENT ACTIVITY FEED — last 10 things, computed across tables
  // ============================================================
  type Activity = {
    when: string
    icon: 'apply' | 'pick' | 'submit' | 'approve' | 'pay' | 'gig' | 'msg'
    label: string
    href?: string
  }
  const activities: Activity[] = []

  // Recent claims TO your gigs (as a flipper)
  if (myFlipperGigIds.length > 0) {
    const { data: recentClaims } = await supabase
      .from('gig_claims')
      .select('id, gig_id, status, created_at, claimed_at')
      .in('gig_id', myFlipperGigIds)
      .order('created_at', { ascending: false })
      .limit(8)

    const titleByGigId = new Map(
      (myFlipperGigsForReview ?? []).map((g: any) => [g.id, g.title])
    )
    for (const c of recentClaims ?? []) {
      const title = titleByGigId.get((c as any).gig_id) || 'a gig'
      activities.push({
        when: (c as any).created_at,
        icon: 'apply',
        label: `Someone applied to your gig "${title}"`,
        href: `/flipper/gigs/${(c as any).gig_id}`,
      })
      if ((c as any).status === 'submitted_for_review') {
        activities.push({
          when: (c as any).claimed_at || (c as any).created_at,
          icon: 'submit',
          label: `Work submitted on "${title}" — awaiting your review`,
          href: `/flipper/review/${(c as any).id}`,
        })
      }
    }
  }

  // Recent claims YOU made (as a worker)
  const { data: myRecentClaims } = await supabase
    .from('gig_claims')
    .select('id, gig_id, status, created_at')
    .eq('worker_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(8)

  if ((myRecentClaims ?? []).length > 0) {
    const gigIds = (myRecentClaims ?? []).map((c: any) => c.gig_id)
    const { data: claimGigs } = await supabase
      .from('gigs')
      .select('id, title, slug')
      .in('id', gigIds)
    const gigById = new Map(
      (claimGigs ?? []).map((g: any) => [g.id, g])
    )
    for (const c of myRecentClaims ?? []) {
      const g: any = gigById.get((c as any).gig_id)
      const title = g?.title || 'a gig'
      const status = (c as any).status

      if (status === 'pending') {
        activities.push({
          when: (c as any).created_at,
          icon: 'apply',
          label: `You applied to "${title}"`,
          href: g?.slug ? `/gigs/${g.slug}` : '/my-gigs',
        })
      } else if (status === 'active') {
        activities.push({
          when: (c as any).created_at,
          icon: 'pick',
          label: `You were picked for "${title}"`,
          href: `/my-gigs/${(c as any).id}`,
        })
      } else if (status === 'approved') {
        activities.push({
          when: (c as any).created_at,
          icon: 'approve',
          label: `Your work on "${title}" was approved`,
          href: `/my-gigs/${(c as any).id}`,
        })
      }
    }
  }

  // Recent payouts (both directions)
  for (const p of payoutsAsWorker ?? []) {
    if ((p as any).payout_status === 'paid') {
      activities.push({
        when: (p as any).payout_date || (p as any).created_at,
        icon: 'pay',
        label: `You received ${formatCurrency(Number((p as any).amount || 0))}`,
        href: '/my-gigs/payouts',
      })
    }
  }
  for (const p of payoutsAsFlipper ?? []) {
    if ((p as any).payout_status === 'paid') {
      activities.push({
        when: (p as any).payout_date || (p as any).created_at,
        icon: 'pay',
        label: `You paid ${formatCurrency(Number((p as any).amount || 0))}`,
        href: '/my-gigs/payouts',
      })
    }
  }

  // Recent gigs you posted
  const { data: recentlyPostedGigs } = await supabase
    .from('gigs')
    .select('id, title, slug, created_at, status')
    .eq('poster_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  for (const g of recentlyPostedGigs ?? []) {
    activities.push({
      when: (g as any).created_at,
      icon: 'gig',
      label: `You posted "${(g as any).title}"`,
      href: `/flipper/gigs/${(g as any).id}`,
    })
  }

  // Sort by time, take top 10
  activities.sort(
    (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()
  )
  const topActivities = activities.slice(0, 10)

  // ============================================================
  // BRAND-NEW USER CHECK
  // ============================================================
  const isBrandNew =
    !userHasActivity &&
    activeTotal === 0 &&
    activities.length === 0

  // Greeting time-of-day
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // How many action cards will actually show — used to stretch a lone card
  const actionCardCount =
    (needsReview.length > 0 ? 1 : 0) +
    (pendingApplicants.length > 0 ? 1 : 0) +
    (workInProgress.length > 0 ? 1 : 0)

  return (
    <div className="min-h-screen bg-background">
      {showWelcomeModal && <WelcomeModal />}
      <Nav role="flipper" userName={navName} userUsername={navUsername} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Greeting */}
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl text-foreground">
              {greeting}, {firstName}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{todayLabel}</p>
          </div>
        </div>

        {/* Add-to-home-screen guide (hides once installed or dismissed) */}
        <AddToHomeScreenPrompt />

        {/* Notifications opt-in — front and center on the page you land on */}
        <EnableNotificationsButton />

        {/* Business setup → business-at-a-glance */}
        <BusinessSetupCard userId={user.id} initial={businessProfile as any} mode="dashboard" />

        {/* Brand-new user welcome */}
        {isBrandNew ? (
          <div className="card card-body py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">
                Welcome to FlipWork.
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                You're early — FlipWork just launched. Post a gig to get help
                on a furniture project, or browse open gigs to pick up some
                work. Your dashboard fills in as you go.
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href="/flipper/post-gig"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Post your first gig
              </Link>
              <Link
                href="/gigs"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
              >
                <Search className="w-4 h-4" />
                Browse open gigs
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Live unread card — manages its own visibility (null when none) */}
            <UnreadMessagesCard />

            {/* ACTION SECTIONS — only render the grid when there's something in it */}
            {(needsReview.length > 0 ||
              pendingApplicants.length > 0 ||
              workInProgress.length > 0) && (
            <div className={`grid gap-4 ${actionCardCount === 1 ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
              {needsReview.length > 0 && (
                <ActionCard
                  icon={<ClipboardCheck className="w-5 h-5 text-accent" />}
                  emphasis
                  title={`${needsReview.length} ready for review`}
                  subtitle="Workers submitted work and are waiting on you"
                >
                  <ul className="space-y-1.5">
                    {needsReview.slice(0, 3).map((r) => (
                      <li key={r.claimId}>
                        <Link
                          href={`/flipper/review/${r.claimId}`}
                          className="text-sm text-foreground hover:text-accent flex items-center gap-1.5 group"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                          <span className="truncate">{r.gigTitle}</span>
                        </Link>
                      </li>
                    ))}
                    {needsReview.length > 3 && (
                      <li className="text-xs text-muted-foreground pl-5">
                        + {needsReview.length - 3} more
                      </li>
                    )}
                  </ul>
                </ActionCard>
              )}

              {pendingApplicants.length > 0 && (
                <ActionCard
                  icon={<AlertCircle className="w-5 h-5 text-accent" />}
                  emphasis
                  title={`${pendingApplicants.reduce((s, p) => s + p.count, 0)} pending applicants`}
                  subtitle={`Across ${pendingApplicants.length} of your gigs`}
                >
                  <ul className="space-y-1.5">
                    {pendingApplicants.slice(0, 3).map((p) => (
                      <li key={p.gigId}>
                        <Link
                          href={`/flipper/gigs/${p.gigId}`}
                          className="text-sm text-foreground hover:text-accent flex items-center justify-between gap-2 group"
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
                            <span className="truncate">{p.gigTitle}</span>
                          </span>
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {p.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </ActionCard>
              )}

              {workInProgress.length > 0 && (
                <ActionCard
                  icon={<Wrench className="w-5 h-5 text-green-600" />}
                  title={`${workInProgress.length} gig${workInProgress.length === 1 ? '' : 's'} in progress`}
                  subtitle="Work you're actively doing"
                >
                  <ul className="space-y-1.5">
                    {workInProgress.slice(0, 3).map((w) => (
                      <li key={w.claimId}>
                        <Link
                          href={`/my-gigs/${w.claimId}`}
                          className="text-sm text-foreground hover:text-accent flex items-center justify-between gap-2 group"
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
                            <span className="truncate">{w.gigTitle}</span>
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {w.status === 'submitted_for_review'
                              ? 'awaiting review'
                              : 'in progress'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </ActionCard>
              )}
            </div>
            )}

            {/* GO TO — navigation hub into each area of the app */}
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Go to</h2>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flipper</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NavTile href="/flipper/post-gig" icon={<Plus className="w-5 h-5" />} title="Post a gig" subtitle="Get help on a project" />
                  <NavTile href="/flipper/dashboard" icon={<ClipboardCheck className="w-5 h-5" />} title="My posted gigs" subtitle="Gigs you've posted" />
                  <NavTile href="/flipper/payouts" icon={<DollarSign className="w-5 h-5" />} title="Payouts" subtitle="Money you've spent" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gigs</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NavTile href="/gigs" icon={<Search className="w-5 h-5" />} title="Browse gigs" subtitle="Find work to pick up" />
                  <NavTile href="/my-gigs" icon={<Briefcase className="w-5 h-5" />} title="My gigs" subtitle="Work you're doing" />
                  <NavTile href="/my-gigs/payouts" icon={<DollarSign className="w-5 h-5" />} title="Payouts" subtitle="Money you've earned" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Marketplace</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NavTile href="/marketplace" icon={<Store className="w-5 h-5" />} title="Marketplace" subtitle="Buy & sell items" />
                  <NavTile href="/marketplace/new" icon={<Tag className="w-5 h-5" />} title="List an item" subtitle="Put something up for sale" />
                  <NavTile href="/marketplace/mine" icon={<Package className="w-5 h-5" />} title="My listings" subtitle="Items you're selling" />
                  <NavTile href="/profile/worker/services" icon={<Hammer className="w-5 h-5" />} title="Services I offer" subtitle="Work you do for hire" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connect</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NavTile href="/messages" icon={<MessageSquare className="w-5 h-5" />} title="Messages" subtitle="Your conversations" />
                  <NavTile href="/connections" icon={<Users className="w-5 h-5" />} title="Connections" subtitle="People you work with" />
                  <NavTile href={publicUsername ? `/u/${publicUsername}` : '/profile'} icon={<User className="w-5 h-5" />} title="Profile" subtitle="Your public page" />
                </div>
              </div>
            </div>

            {/* CHART — only shown once real gig money has moved */}
            {(totalEarned > 0 || totalInvested > 0) && (
              <ActivityChart data={chartData} />
            )}

            {/* RECENT ACTIVITY */}
            {topActivities.length > 0 && (
              <div className="card card-body space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Recent activity
                </h2>
                <ul className="divide-y divide-border">
                  {topActivities.map((a, i) => (
                    <li key={i} className="py-2">
                      {a.href ? (
                        <Link
                          href={a.href}
                          className="flex items-center gap-3 group"
                        >
                          <ActivityIcon icon={a.icon} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground group-hover:text-accent transition-colors truncate">
                              {a.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(a.when)}
                            </p>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3">
                          <ActivityIcon icon={a.icon} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {a.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(a.when)}
                            </p>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ============================================================
// Small presentational helpers (server-rendered, no client hooks)
// ============================================================

function NavTile({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="card card-body hover:border-accent hover:bg-stone-50 transition-colors group"
    >
      <div className="text-foreground group-hover:text-accent transition-colors">
        {icon}
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </Link>
  )
}

function ActionCard({
  icon,
  title,
  subtitle,
  emphasis,
  children,
  href,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  emphasis?: boolean
  children?: React.ReactNode
  href?: string
}) {
  const className = `card card-body space-y-3 ${
    emphasis ? 'border-accent/40 ring-1 ring-accent/20' : ''
  }`

  const inner = (
    <>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={`${className} block hover:shadow-md transition-shadow`}
      >
        {inner}
      </Link>
    )
  }
  return <div className={className}>{inner}</div>
}

function ActivityIcon({ icon }: { icon: string }) {
  const map: Record<string, { Icon: any; bg: string; text: string }> = {
    apply: { Icon: AlertCircle, bg: 'bg-accent/10', text: 'text-accent' },
    pick: { Icon: Sparkles, bg: 'bg-blue-50', text: 'text-blue-600' },
    submit: { Icon: ClipboardCheck, bg: 'bg-accent/10', text: 'text-accent' },
    approve: { Icon: Trophy, bg: 'bg-green-50', text: 'text-green-600' },
    pay: { Icon: DollarSign, bg: 'bg-green-50', text: 'text-green-600' },
    gig: { Icon: Briefcase, bg: 'bg-muted', text: 'text-foreground' },
    msg: { Icon: MessageSquare, bg: 'bg-blue-50', text: 'text-blue-600' },
  }
  const { Icon, bg, text } = map[icon] || map.gig
  return (
    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
      <Icon className={`w-4 h-4 ${text}`} />
    </div>
  )
}
