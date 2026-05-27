import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

// Always fetch fresh — payouts can move from pending -> paid at any time
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Flipper-side payouts view.
 *
 * Scoped strictly to gigs the current user posted — relies on the
 * "Gig posters can view payouts on their gigs" RLS policy
 * (schema_payout_records_flipper_read_20260527.sql) so the SELECT
 * automatically returns only payout rows attached to gigs whose
 * poster_user_id (or fallback created_by) is this user.
 *
 * Mirrors /admin/payouts in structure but uses a left join on
 * worker_profiles so payouts whose worker hasn't completed their
 * profile still show up (they just show "Unknown worker"). The
 * admin page used an inner join which silently hid those rows.
 */
export default async function FlipperPayoutsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // RLS scopes this to the current flipper's gigs automatically.
  // Left join (no !inner) so records still appear if the worker
  // profile is missing for any reason.
  const { data: payoutsRaw } = await supabase
    .from('payout_records')
    .select(`
      *,
      gigs(title),
      worker_profiles(first_name, last_name)
    `)
    .order('created_at', { ascending: false })

  const payouts = (payoutsRaw ?? []) as Array<{
    id: string
    amount: number
    payout_status: string
    payout_date: string | null
    payout_reference: string
    gigs: { title: string } | null
    worker_profiles: { first_name: string; last_name: string } | null
  }>

  const unpaid = payouts.filter((p) => p.payout_status === 'unpaid')
  const pending = payouts.filter((p) => p.payout_status === 'pending')
  const paid = payouts.filter((p) => p.payout_status === 'paid')

  const totalUnpaid = unpaid.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPending = pending.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPaid = paid.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/flipper/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to dashboard
        </Link>
        <h1 className="text-3xl text-foreground">My Payouts</h1>
        <p className="text-muted-foreground mt-1">
          Money paid out on gigs you&apos;ve posted.
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card card-body space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Owed</p>
          <p className="text-2xl font-mono font-semibold text-destructive">{formatCurrency(totalUnpaid)}</p>
          <p className="text-xs text-muted-foreground">{unpaid.length} {unpaid.length === 1 ? 'record' : 'records'}</p>
        </div>
        <div className="card card-body space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pending</p>
          <p className="text-2xl font-mono font-semibold text-amber-600">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-muted-foreground">{pending.length} {pending.length === 1 ? 'record' : 'records'}</p>
        </div>
        <div className="card card-body space-y-1 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Paid (all time)</p>
          <p className="text-2xl font-mono font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-muted-foreground">{paid.length} {paid.length === 1 ? 'record' : 'records'}</p>
        </div>
      </div>

      {/* Outstanding (unpaid + pending) */}
      {(unpaid.length > 0 || pending.length > 0) && (
        <section className="space-y-3">
          <h2 className="font-sans font-semibold text-lg text-foreground">Outstanding</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Worker</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Gig</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...unpaid, ...pending].map((payout) => {
                  const worker = payout.worker_profiles
                  const gig = payout.gigs
                  const workerName = worker
                    ? `${worker.first_name} ${worker.last_name}`.trim() || 'Unknown worker'
                    : 'Unknown worker'
                  return (
                    <tr key={payout.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{workerName}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{gig?.title ?? '—'}</td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">{formatCurrency(payout.amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            payout.payout_status === 'pending'
                              ? 'inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200'
                              : 'inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200'
                          }
                        >
                          {payout.payout_status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Paid history */}
      {paid.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-sans font-semibold text-lg text-foreground">Paid</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Worker</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Gig</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paid.map((payout) => {
                  const worker = payout.worker_profiles
                  const gig = payout.gigs
                  const workerName = worker
                    ? `${worker.first_name} ${worker.last_name}`.trim() || 'Unknown worker'
                    : 'Unknown worker'
                  return (
                    <tr key={payout.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{workerName}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{gig?.title ?? '—'}</td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">{formatCurrency(payout.amount)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{formatDate(payout.payout_date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {payouts.length === 0 && (
        <div className="card card-body text-center py-16 text-muted-foreground">
          No payouts yet. They&apos;ll appear here once a worker completes
          one of your gigs and you approve the work.
        </div>
      )}
    </div>
  )
}
