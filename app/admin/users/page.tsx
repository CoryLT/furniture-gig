import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Crown, Sparkles, Users as UsersIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'
import { isPro } from '@/lib/plan'
import UsersTable from './UsersTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// /admin/users
// ============================================================
// A single scannable table of every account: email, when they
// joined, whether they're on Pro, how many pieces they've logged,
// and when they last touched something. Ordered newest-first so
// new signups float to the top.
//
// This is the page Cory opens when he sees "1 paying subscriber"
// or "3 new signups this week" on the dashboard and wants to know
// WHO. It's read-only — no editing, no impersonation, no delete.
// If we ever need account admin actions we can add them per row.
//
// Data is fetched with the service-role client (bypasses RLS) so
// the dashboard sees platform-wide rows instead of just the admin's
// own session. The role check above the fetch keeps this safe.
// ============================================================

export type UserRowVM = {
  id: string
  email: string
  role: string | null
  joinedAt: string
  proBadge: 'Paying' | 'Trial' | 'Founding' | null
  totalPieces: number
  soldPieces: number
  lastActive: string | null
}

export default async function AdminUsersPage() {
  const userClient = createClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) redirect('/auth/login?next=/admin/users')

  const { data: me } = await userClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!me || (me as { role?: string }).role !== 'admin') redirect('/home')

  const admin = createAdminClient()

  // Batch-fetch everything in parallel. Even a couple hundred users
  // is cheap; if this ever needs to scale we'll add pagination.
  const [usersRes, subsRes, piecesRes] = await Promise.all([
    admin
      .from('users')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('subscriptions').select('user_id, status, is_founding'),
    admin
      .from('inventory_pieces')
      .select('owner_user_id, stage, updated_at'),
  ])

  // Build a per-user index of subscription state.
  type SubEntry = { status: string | null; is_founding: boolean | null }
  const subByUser = new Map<string, SubEntry>()
  for (const s of (subsRes.data ?? []) as Array<
    { user_id: string } & SubEntry
  >) {
    subByUser.set(s.user_id, {
      status: s.status,
      is_founding: s.is_founding,
    })
  }

  // Roll up piece stats per user in a single pass.
  type PieceStats = { total: number; sold: number; lastActive: string }
  const statsByUser = new Map<string, PieceStats>()
  for (const p of (piecesRes.data ?? []) as Array<{
    owner_user_id: string
    stage: string | null
    updated_at: string
  }>) {
    const cur = statsByUser.get(p.owner_user_id) ?? {
      total: 0,
      sold: 0,
      lastActive: '',
    }
    cur.total += 1
    if (p.stage === 'sold') cur.sold += 1
    if (p.updated_at && p.updated_at > cur.lastActive) {
      cur.lastActive = p.updated_at
    }
    statsByUser.set(p.owner_user_id, cur)
  }

  // Compose the view-model rows the table renders.
  const rows: UserRowVM[] = (
    (usersRes.data ?? []) as Array<{
      id: string
      email: string | null
      role: string | null
      created_at: string
    }>
  ).map((u) => {
    const sub = subByUser.get(u.id) ?? null
    let badge: UserRowVM['proBadge'] = null
    if (sub) {
      if (sub.is_founding) badge = 'Founding'
      else if (sub.status === 'trialing') badge = 'Trial'
      else if (
        isPro({
          status: sub.status ?? '',
          is_founding: !!sub.is_founding,
          stripe_customer_id: null,
          current_period_end: null,
        })
      )
        badge = 'Paying'
    }
    const stats = statsByUser.get(u.id) ?? {
      total: 0,
      sold: 0,
      lastActive: '',
    }
    return {
      id: u.id,
      email: u.email ?? '(no email)',
      role: u.role,
      joinedAt: u.created_at,
      proBadge: badge,
      totalPieces: stats.total,
      soldPieces: stats.sold,
      lastActive: stats.lastActive || null,
    }
  })

  const proCount = rows.filter((r) => r.proBadge).length
  const activeCount = rows.filter((r) => {
    if (!r.lastActive) return false
    const days =
      (Date.now() - new Date(r.lastActive).getTime()) / (1000 * 60 * 60 * 24)
    return days <= 7
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to dashboard
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl text-foreground">Users</h1>
            <p className="text-muted-foreground mt-1">
              Every account on FlipWork. Newest first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SummaryChip
              icon={<UsersIcon className="w-3.5 h-3.5" />}
              label={`${rows.length} total`}
            />
            <SummaryChip
              icon={<Crown className="w-3.5 h-3.5 text-amber-600" />}
              label={`${proCount} on Pro`}
            />
            <SummaryChip
              icon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
              label={`${activeCount} active (7d)`}
            />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="card-body text-sm text-muted-foreground py-12 text-center">
            No users yet. Once people sign up, they&apos;ll show up here.
          </div>
        </div>
      ) : (
        <UsersTable rows={rows} />
      )}

      <p className="text-xs text-muted-foreground">
        Showing up to 500 most recent accounts. If you need older accounts,
        say the word and we&apos;ll add pagination.
      </p>
    </div>
  )
}

function SummaryChip({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border">
      {icon}
      {label}
    </span>
  )
}

// Convenience helper for the client table — keeps date formatting
// consistent whether we're rendering server-side headers or client-side
// cells (this is used by the export type, not directly here).
export function formatJoined(iso: string): string {
  return formatDate(iso)
}
