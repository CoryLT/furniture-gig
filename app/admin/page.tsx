import Link from 'next/link'
import {
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Flag,
  MessageSquare,
  Activity,
  CheckCircle2,
  Clock,
  ShoppingBag,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// FlipWork Admin Dashboard
// ============================================================
// Replaces the old "quick links + new gig" admin landing page
// with a real ops/analytics view. No editing or posting happens
// here — that all lives on the user side. This is for Cory to
// see how the platform is doing.
// ============================================================

type PayoutRow = {
  id: string
  gig_id: string
  amount: number | null
  gross_amount: number | null
  platform_fee_amount: number | null
  payment_status: string | null
  payout_status: string | null
  created_at: string
}

type GigRow = {
  id: string
  title: string
  status: string
  pay_amount: number | null
  created_at: string
}

type UserRow = {
  id: string
  email: string | null
  role: string | null
  created_at: string
}

type ListingRow = {
  id: string
  title: string
  status: string
  created_at: string
}

// Money-touched payments (real money has moved or is held).
const REAL_MONEY_STATUSES = ['authorized', 'captured', 'transferred', 'refunded']

export default async function AdminDashboard() {
  // Verify the caller is actually an admin before bypassing RLS.
  // We check role using the user's own session (which CAN read its own row),
  // then if they pass, switch to the service-role client so RLS doesn't hide
  // platform-wide rows (like other users) from the admin dashboard.
  const userClient = createClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/admin')
  }

  const { data: me } = await userClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!me || (me as { role?: string }).role !== 'admin') {
    redirect('/home')
  }

  // From here on, use the service-role client. It bypasses RLS so the
  // dashboard sees real platform-wide totals instead of just rows the
  // current admin's own session can see.
  const supabase = createAdminClient()

  // 30-day window for time-bounded metrics
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  // ---------- COUNTS ----------
  const [
    { count: totalUsers },
    { count: usersThisWeek },
    { count: totalGigs },
    { count: gigsThisWeek },
    { count: openGigs },
    { count: activeClaims },
    { count: totalListings },
    { count: escalatedSupport },
    { count: openImageReports },
    { count: openListingReports },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgoISO),
    supabase.from('gigs').select('id', { count: 'exact', head: true }),
    supabase
      .from('gigs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgoISO),
    supabase
      .from('gigs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('gig_claims')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'submitted_for_review']),
    supabase
      .from('marketplace_listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('support_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'escalated'),
    supabase
      .from('image_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('listing_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
  ])

  // ---------- MONEY ----------
  // Pull all payouts that touched real money for the all-time totals,
  // and ALL payouts in the last 30 days for the chart.
  const { data: moneyPayoutsRaw } = await supabase
    .from('payout_records')
    .select(
      'id, gig_id, amount, gross_amount, platform_fee_amount, payment_status, payout_status, created_at',
    )
    .in('payment_status', REAL_MONEY_STATUSES)

  const moneyPayouts = (moneyPayoutsRaw ?? []) as PayoutRow[]

  // All-time platform money flow = sum of gross_amount on captured/transferred.
  const movedStatuses = ['captured', 'transferred']
  const totalGmv = moneyPayouts
    .filter((p) => p.payment_status && movedStatuses.includes(p.payment_status))
    .reduce((sum, p) => sum + Number(p.gross_amount ?? p.amount ?? 0), 0)

  // All-time platform fees earned (your 2%).
  const totalPlatformFees = moneyPayouts
    .filter((p) => p.payment_status && movedStatuses.includes(p.payment_status))
    .reduce((sum, p) => sum + Number(p.platform_fee_amount ?? 0), 0)

  // Money in flight (authorized but not yet captured)
  const moneyInFlight = moneyPayouts
    .filter((p) => p.payment_status === 'authorized')
    .reduce((sum, p) => sum + Number(p.gross_amount ?? p.amount ?? 0), 0)

  // ---------- 30-DAY MONEY CHART ----------
  // Group captured-money days into a daily bar chart.
  const chartPayouts = moneyPayouts.filter(
    (p) =>
      new Date(p.created_at) >= thirtyDaysAgo &&
      p.payment_status &&
      movedStatuses.includes(p.payment_status),
  )

  // Bucket by YYYY-MM-DD
  const dailyTotals = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    dailyTotals.set(key, 0)
  }
  for (const p of chartPayouts) {
    const key = p.created_at.slice(0, 10)
    if (dailyTotals.has(key)) {
      dailyTotals.set(
        key,
        (dailyTotals.get(key) ?? 0) + Number(p.gross_amount ?? p.amount ?? 0),
      )
    }
  }
  const chartData = Array.from(dailyTotals.entries()).map(([day, amt]) => ({
    day,
    amount: amt,
  }))
  const maxDaily = Math.max(1, ...chartData.map((d) => d.amount))

  // ---------- RECENT ACTIVITY ----------
  // Pull the most recent items across a few tables and merge into one feed.
  const [
    { data: recentUsersRaw },
    { data: recentGigsRaw },
    { data: recentListingsRaw },
    { data: recentPayoutsRaw },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('gigs')
      .select('id, title, status, pay_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('marketplace_listings')
      .select('id, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('payout_records')
      .select(
        'id, gig_id, gross_amount, payment_status, created_at',
      )
      .in('payment_status', REAL_MONEY_STATUSES)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  type ActivityEvent = {
    when: string
    kind: 'signup' | 'gig' | 'listing' | 'payment'
    label: string
    href: string | null
  }

  const events: ActivityEvent[] = []

  for (const u of (recentUsersRaw ?? []) as UserRow[]) {
    events.push({
      when: u.created_at,
      kind: 'signup',
      label: u.email
        ? `New signup — ${u.email}`
        : `New signup — ${u.role ?? 'user'}`,
      href: null,
    })
  }
  for (const g of (recentGigsRaw ?? []) as GigRow[]) {
    events.push({
      when: g.created_at,
      kind: 'gig',
      label: `Gig posted: "${g.title}" — ${formatCurrency(g.pay_amount ?? 0)}`,
      href: `/admin/gigs`,
    })
  }
  for (const l of (recentListingsRaw ?? []) as ListingRow[]) {
    events.push({
      when: l.created_at,
      kind: 'listing',
      label: `Listing posted: "${l.title}"`,
      href: null,
    })
  }
  for (const p of (recentPayoutsRaw ?? []) as Array<{
    id: string
    gig_id: string
    gross_amount: number | null
    payment_status: string | null
    created_at: string
  }>) {
    const statusLabel =
      p.payment_status === 'authorized'
        ? 'authorized'
        : p.payment_status === 'captured'
        ? 'captured'
        : p.payment_status === 'transferred'
        ? 'paid to worker'
        : p.payment_status === 'refunded'
        ? 'refunded'
        : p.payment_status ?? 'updated'
    events.push({
      when: p.created_at,
      kind: 'payment',
      label: `Payment ${statusLabel} — ${formatCurrency(
        Number(p.gross_amount ?? 0),
      )}`,
      href: `/admin/payouts`,
    })
  }

  events.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
  const recentEvents = events.slice(0, 20)

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          FlipWork at a glance — updated in real time.
        </p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<Users className="w-4 h-4 text-blue-600" />}
          tint="blue"
          label="Total users"
          value={String(totalUsers ?? 0)}
          sub={
            usersThisWeek
              ? `+${usersThisWeek} this week`
              : 'No new signups this week'
          }
        />
        <StatTile
          icon={<Briefcase className="w-4 h-4 text-foreground" />}
          tint="neutral"
          label="Total gigs"
          value={String(totalGigs ?? 0)}
          sub={
            gigsThisWeek
              ? `+${gigsThisWeek} this week`
              : 'No new gigs this week'
          }
        />
        <StatTile
          icon={<DollarSign className="w-4 h-4 text-accent" />}
          tint="accent"
          label="Total $ moved"
          value={formatCurrency(totalGmv)}
          sub={
            moneyInFlight > 0
              ? `${formatCurrency(moneyInFlight)} in flight`
              : 'All settled'
          }
        />
        <StatTile
          icon={<TrendingUp className="w-4 h-4 text-green-600" />}
          tint="green"
          label="Platform fees"
          value={formatCurrency(totalPlatformFees)}
          sub="2% of gigs paid"
        />
      </div>

      {/* Money chart */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Money flow — last 30 days
              </h2>
              <p className="text-xs text-muted-foreground">
                Daily total of captured payments (excludes authorizations
                that haven&apos;t been captured yet)
              </p>
            </div>
          </div>

          {totalGmv === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No captured payments yet. The chart will fill in as gigs are
              paid out.
            </div>
          ) : (
            <MoneyBars data={chartData} max={maxDaily} />
          )}
        </div>
      </div>

      {/* Operational tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OpsTile
          icon={<Briefcase className="w-4 h-4 text-foreground" />}
          label="Open gigs"
          value={openGigs ?? 0}
          href="/admin/gigs"
        />
        <OpsTile
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          label="Active claims"
          value={activeClaims ?? 0}
          href="/admin/gigs"
        />
        <OpsTile
          icon={<ShoppingBag className="w-4 h-4 text-foreground" />}
          label="Live listings"
          value={totalListings ?? 0}
          href="/marketplace"
        />
        <OpsTile
          icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
          label="All settled?"
          value={moneyInFlight === 0 ? 'Yes' : 'No'}
          href="/admin/payouts"
          tint={moneyInFlight === 0 ? 'green' : 'amber'}
        />
      </div>

      {/* Attention required */}
      {(escalatedSupport ?? 0) +
        (openImageReports ?? 0) +
        (openListingReports ?? 0) >
        0 && (
        <div className="card border-amber-300/60 bg-amber-50/50">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  Needs your attention
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(escalatedSupport ?? 0) > 0 && (
                    <Link
                      href="/admin/support"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:bg-muted"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {escalatedSupport} escalated chat
                      {escalatedSupport === 1 ? '' : 's'}
                    </Link>
                  )}
                  {(openImageReports ?? 0) > 0 && (
                    <Link
                      href="/admin/reports"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:bg-muted"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      {openImageReports} flagged image
                      {openImageReports === 1 ? '' : 's'}
                    </Link>
                  )}
                  {(openListingReports ?? 0) > 0 && (
                    <Link
                      href="/admin/reports"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:bg-muted"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      {openListingReports} flagged listing
                      {openListingReports === 1 ? '' : 's'}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity feed */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Recent activity
            </h2>
          </div>

          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nothing yet. As people sign up and post gigs, you&apos;ll see
              them here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentEvents.map((e, i) => (
                <li
                  key={i}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <EventDot kind={e.kind} />
                    <div className="min-w-0">
                      {e.href ? (
                        <Link
                          href={e.href}
                          className="text-sm text-foreground hover:text-accent truncate block"
                        >
                          {e.label}
                        </Link>
                      ) : (
                        <p className="text-sm text-foreground truncate">
                          {e.label}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(e.when)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Helpers + tiny presentational components
// ============================================================

function StatTile({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  tint: 'blue' | 'neutral' | 'accent' | 'green'
  label: string
  value: string
  sub?: string
}) {
  const tintBg = {
    blue: 'bg-blue-50',
    neutral: 'bg-muted',
    accent: 'bg-accent/10',
    green: 'bg-green-50',
  }[tint]
  return (
    <div className="card card-body">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tintBg}`}>
          {icon}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function OpsTile({
  icon,
  label,
  value,
  href,
  tint,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  href: string
  tint?: 'green' | 'amber'
}) {
  const tintBorder =
    tint === 'green'
      ? 'border-green-200'
      : tint === 'amber'
      ? 'border-amber-200'
      : 'border-border'
  return (
    <Link
      href={href}
      className={`card card-body hover:shadow-md transition-shadow ${tintBorder}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </Link>
  )
}

function MoneyBars({
  data,
  max,
}: {
  data: { day: string; amount: number }[]
  max: number
}) {
  // Hand-rolled SVG bar chart, same visual style as the home dashboard.
  const width = 700
  const height = 140
  const padding = 8
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const barW = innerW / data.length

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-32 min-w-[600px]"
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const h = max > 0 ? (d.amount / max) * innerH : 0
          const x = padding + i * barW
          const y = padding + (innerH - h)
          return (
            <rect
              key={d.day}
              x={x + 1}
              y={y}
              width={Math.max(0, barW - 2)}
              height={h}
              rx="2"
              className="fill-accent"
              opacity={d.amount === 0 ? 0.15 : 0.85}
            >
              <title>{`${d.day}: ${formatCurrency(d.amount)}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
        <span>{data[0]?.day && formatDate(data[0].day)}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function EventDot({ kind }: { kind: 'signup' | 'gig' | 'listing' | 'payment' }) {
  const color = {
    signup: 'bg-blue-500',
    gig: 'bg-foreground',
    listing: 'bg-amber-500',
    payment: 'bg-green-500',
  }[kind]
  return (
    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color}`} />
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return formatDate(iso)
}
