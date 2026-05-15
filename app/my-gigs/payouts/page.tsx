import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate, payoutStatusClass, payoutStatusLabel } from '@/lib/utils'

export default async function MyPayoutsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: payouts } = await supabase
    .from('payout_records')
    .select(`*, gigs(title)`)
    .eq('worker_user_id', user.id)
    .order('created_at', { ascending: false })

  const totalPaid = payouts
    ?.filter((p) => p.payout_status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0

  const totalPending = payouts
    ?.filter((p) => p.payout_status !== 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">My Payouts</h1>
        <p className="text-muted-foreground mt-1">Your earnings from completed gigs.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card card-body space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pending payment</p>
          <p className="text-2xl font-mono font-semibold text-amber-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="card card-body space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total earned</p>
          <p className="text-2xl font-mono font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Payout list */}
      {(!payouts || payouts.length === 0) ? (
        <div className="card card-body text-center py-12 text-muted-foreground">
          No payout records yet. Complete a gig to earn your first payout.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gig</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.map((payout) => {
                const gig = payout.gigs as any
                return (
                  <tr key={payout.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{gig?.title ?? '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{formatCurrency(payout.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={payoutStatusClass(payout.payout_status)}>
                        {payoutStatusLabel(payout.payout_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {payout.payout_date ? formatDate(payout.payout_date) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
