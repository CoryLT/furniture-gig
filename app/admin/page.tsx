import Link from 'next/link'
import {
  Users,
  Package,
  AlertCircle,
  Flag,
  MessageSquare,
  Activity,
  Crown,
  DollarSign,
  Sparkles,
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
// FlipWork is now an operator-only hub (workers/gigs/marketplace
// are shelved). This dashboard reflects that: user growth, Pro
// subscribers, MRR, and engagement measured by pieces logged.
// No gig or marketplace stats appear here.
// ============================================================

type UserRow = {
  id: string
  email: string | null
  role: string | null
  created_at: string
}

type PieceRow = {
  id: string
  title: string | null
  stage: string | null
  sale_price: number | null
  owner_user_id: string
  created_at: string
  sold_at: string | null
}

type SubRow = {
  user_id: string
  status: string | null
  is_founding: boolean | null
  updated_at: string
}

// Priced at $9/mo — matches PRO_PRICE_LABEL in lib/plan.ts. If the
// price changes, update both.
const PRO_MONTHLY_PRICE = 9

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
    { count: totalPieces },
    { count: piecesThisWeek },
    { count: piecesSoldThisWeek },
    { count: escalatedSupport },
    { count: openImageReports },
    { count: proUsers },
    { count: foundingUsers },
    { count: trialingUsers },
    { data: activeOwnerRows },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgoISO),
    supabase.from('inventory_pieces').select('id', { count: 'exact', head: true }),
    supabase
      .from('inventory_pieces')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgoISO),
    supabase
      .from('inventory_pieces')
      .select('id', { count: 'exact', head: true })
      .eq('stage', 'sold')
      .gte('sold_at', sevenDaysAgoISO),
    supabase
      .from('support_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'escalated'),
    supabase
      .from('image_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    // Anyone on Pro right now: paying (active), on a trial, or comped
    // via is_founding. Same rule as lib/plan.ts#isPro so the count
    // matches what users experience in the app.
    supabase
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .or('status.eq.active,status.eq.trialing,is_founding.eq.true'),
    // Comped/founding members (subset of the Pro count above).
    supabase
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('is_founding', true),
    // On a paid trial (subset of the Pro count above).
    supabase
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'trialing'),
    // Active operators this week — anyone who created or touched a
    // piece within the last 7 days. We fetch owner ids and dedupe in
    // JS (Supabase JS doesn't do DISTINCT directly).
    supabase
      .from('inventory_pieces')
      .select('owner_user_id')
      .gte('updated_at', sevenDaysAgoISO),
  ])

  // Split Pro into "paying" (real money) vs "comped" (founding members
  // get Pro for free) so Cory sees the actual revenue-generating count.
  const founding = foundingUsers ?? 0
  const trialing = trialingUsers ?? 0
  const totalPro = proUsers ?? 0
  const paying = Math.max(0, totalPro - founding - trialing)

  // MRR estimate = paying users × monthly price. Doesn't try to model
  // Stripe discounts or annual plans — just a directional number.
  const estimatedMrr = paying * PRO_MONTHLY_PRICE

  // Distinct operators active this week
  const activeOperators = new Set(
    ((activeOwnerRows ?? []) as { owner_user_id: string }[]).map(
      (r) => r.owner_user_id,
    ),
  ).size

  // ---------- 30-DAY SIGNUP CHART ----------
  // Growth is the story we care about, so replace the old money-flow
  // chart with a daily-signup bar chart over the last 30 days.
  const { data: chartUsersRaw } = await supabase
    .from('users')
    .select('id, created_at')
    .gte('created_at', thirtyDaysAgoISO)

  // Bucket by YYYY-MM-DD, filling in zero-days so the chart is dense.
  const dailyTotals = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const key = d.toISOString().slice(0, 10)
    dailyTotals.set(key, 0)
  }
  for (const u of (chartUsersRaw ?? []) as { created_at: string }[]) {
    const key = u.created_at.slice(0, 10)
    if (dailyTotals.has(key)) {
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + 1)
    }
  }
  const chartData = Array.from(dailyTotals.entries()).map(([day, amt]) => ({
    day,
    amount: amt,
  }))
  const maxDaily = Math.max(1, ...chartData.map((d) => d.amount))
  const totalSignups30d = chartData.reduce((s, d) => s + d.amount, 0)

  // ---------- RECENT ACTIVITY ----------
  // Signups, Pro upgrades, and pieces added across all operators.
  const [
    { data: recentUsersRaw },
    { data: recentPiecesRaw },
    { data: recentSubsRaw },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('inventory_pieces')
      .select('id, title, stage, sale_price, owner_user_id, created_at, sold_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('subscriptions')
      .select('user_id, status, is_founding, updated_at')
      .or('status.eq.active,status.eq.trialing,is_founding.eq.true')
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  // Resolve owner emails for the recent pieces + Pro upgrades so the
  // activity feed has names, not raw uuids. One batched lookup so we
  // don't fire N sequential queries.
  const idsToResolve = new Set<string>()
  for (const p of (recentPiecesRaw ?? []) as PieceRow[]) idsToResolve.add(p.owner_user_id)
  for (const s of (recentSubsRaw ?? []) as SubRow[]) idsToResolve.add(s.user_id)
  const idList = Array.from(idsToResolve)
  const emailById = new Map<string, string>()
  if (idList.length > 0) {
    const { data: usersLookup } = await supabase
      .from('users')
      .select('id, email')
      .in('id', idList)
    for (const u of (usersLookup ?? []) as { id: string; email: string | null }[]) {
      if (u.email) emailById.set(u.id, u.email)
    }
  }

  type ActivityEvent = {
    when: string
    kind: 'signup' | 'piece' | 'sold' | 'pro'
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

  for (const p of (recentPiecesRaw ?? []) as PieceRow[]) {
    const ownerLabel = emailById.get(p.owner_user_id) || 'user'
    const title = (p.title || '').trim() || 'Untitled piece'
    // Emit a 'sold' event if the piece was sold, using sold_at as the
    // timestamp so it lands correctly in the feed. Otherwise emit the
    // created event.
    if (p.stage === 'sold' && p.sold_at) {
      const price = Number(p.sale_price ?? 0)
      events.push({
        when: p.sold_at,
        kind: 'sold',
        label:
          `Piece sold — "${title}"` +
          (price > 0 ? ` for ${formatCurrency(price)}` : '') +
          ` (${ownerLabel})`,
        href: null,
      })
    } else {
      events.push({
        when: p.created_at,
        kind: 'piece',
        label: `Piece added — "${title}" (${ownerLabel})`,
        href: null,
      })
    }
  }

  for (const s of (recentSubsRaw ?? []) as SubRow[]) {
    const owner = emailById.get(s.user_id) || 'user'
    let label: string
    if (s.is_founding) label = `Founding member — ${owner}`
    else if (s.status === 'trialing') label = `Pro trial started — ${owner}`
    else label = `Pro upgrade — ${owner}`
    events.push({
      when: s.updated_at,
      kind: 'pro',
      label,
      href: null,
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          icon={<Crown className="w-4 h-4 text-amber-600" />}
          tint="amber"
          label="Pro subscribers"
          value={String(totalPro)}
          sub={
            totalPro === 0
              ? 'No Pro users yet'
              : [
                  `${paying} paying`,
                  trialing > 0 ? `${trialing} on trial` : null,
                  founding > 0 ? `${founding} founding` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
          }
        />
        <StatTile
          icon={<DollarSign className="w-4 h-4 text-green-600" />}
          tint="green"
          label="Est. MRR"
          value={formatCurrency(estimatedMrr)}
          sub={
            paying === 0
              ? 'No paying users yet'
              : `${paying} × ${formatCurrency(PRO_MONTHLY_PRICE)}/mo`
          }
        />
        <StatTile
          icon={<Package className="w-4 h-4 text-foreground" />}
          tint="neutral"
          label="Total pieces logged"
          value={String(totalPieces ?? 0)}
          sub={
            piecesThisWeek
              ? `+${piecesThisWeek} this week`
              : 'No new pieces this week'
          }
        />
        <StatTile
          icon={<Sparkles className="w-4 h-4 text-accent" />}
          tint="accent"
          label="Active this week"
          value={String(activeOperators)}
          sub={
            activeOperators === 0
              ? 'No active operators'
              : `logged a piece in 7 days`
          }
        />
      </div>

      {/* Signups chart — early-stage this is the number to watch */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Signups — last 30 days
              </h2>
              <p className="text-xs text-muted-foreground">
                {totalSignups30d === 0
                  ? 'Daily new-user count. Nothing in the last 30 days.'
                  : `Daily new-user count · ${totalSignups30d} new user${
                      totalSignups30d === 1 ? '' : 's'
                    } in the last 30 days`}
              </p>
            </div>
          </div>

          {totalSignups30d === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No signups yet in the last 30 days. The chart will fill in as
              people join.
            </div>
          ) : (
            <DailyBars data={chartData} max={maxDaily} />
          )}
        </div>
      </div>

      {/* Operational tiles — engagement + moderation queues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OpsTile
          icon={<Package className="w-4 h-4 text-foreground" />}
          label="Pieces sold this week"
          value={piecesSoldThisWeek ?? 0}
          href="/admin"
        />
        <OpsTile
          icon={<Sparkles className="w-4 h-4 text-accent" />}
          label="Active operators (7d)"
          value={activeOperators}
          href="/admin"
        />
        <OpsTile
          icon={<MessageSquare className="w-4 h-4 text-foreground" />}
          label="Escalated support"
          value={escalatedSupport ?? 0}
          href="/admin/support"
          tint={(escalatedSupport ?? 0) > 0 ? 'amber' : undefined}
        />
        <OpsTile
          icon={<Flag className="w-4 h-4 text-foreground" />}
          label="Flagged images"
          value={openImageReports ?? 0}
          href="/admin/reports"
          tint={(openImageReports ?? 0) > 0 ? 'amber' : undefined}
        />
      </div>

      {/* Attention required */}
      {(escalatedSupport ?? 0) + (openImageReports ?? 0) > 0 && (
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
  tint: 'blue' | 'neutral' | 'accent' | 'green' | 'amber'
  label: string
  value: string
  sub?: string
}) {
  const tintBg = {
    blue: 'bg-blue-50',
    neutral: 'bg-muted',
    accent: 'bg-accent/10',
    green: 'bg-green-50',
    amber: 'bg-amber-50',
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

function DailyBars({
  data,
  max,
}: {
  data: { day: string; amount: number }[]
  max: number
}) {
  // Hand-rolled SVG bar chart. Height is proportional to `amount`
  // (used for money or counts — same shape either way).
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
              <title>{`${d.day}: ${d.amount} signup${d.amount === 1 ? '' : 's'}`}</title>
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

function EventDot({ kind }: { kind: 'signup' | 'piece' | 'sold' | 'pro' }) {
  const color = {
    signup: 'bg-blue-500',
    piece: 'bg-foreground',
    sold: 'bg-green-500',
    pro: 'bg-amber-500',
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
