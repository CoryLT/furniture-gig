import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, payoutStatusClass, payoutStatusLabel } from '@/lib/utils'
import PayoutRow from './PayoutRow'

export default async function AdminPayoutsPage() {
  const supabase = createClient()

  const { data: payouts } = await supabase
    .from('payout_records')
    .select(`
      *,
      gigs(title),
      worker_profiles!inner(first_name, last_name, paypal_email)
    `)
    .order('created_at', { ascending: false })

  const unpaid = payouts?.filter((p) => p.payout_status === 'unpaid') ?? []
  const pending = payouts?.filter((p) => p.payout_status === 'pending') ?? []
  const paid = payouts?.filter((p) => p.payout_status === 'paid') ?? []

  const totalUnpaid = unpaid.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalPaid = paid.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">Payouts</h1>
        <p className="text-muted-foreground mt-1">Manual PayPal payout tracking</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card card-body space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Owed</p>
          <p className="text-2xl font-mono font-semibold text-destructive">{formatCurrency(totalUnpaid)}</p>
          <p className="text-xs text-muted-foreground">{unpaid.length} records</p>
        </div>
        <div className="card card-body space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pending</p>
          <p className="text-2xl font-mono font-semibold text-amber-600">{formatCurrency(pending.reduce((s, p) => s + Number(p.amount), 0))}</p>
          <p className="text-xs text-muted-foreground">{pending.length} records</p>
        </div>
        <div className="card card-body space-y-1 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Paid (all time)</p>
          <p className="text-2xl font-mono font-semibold text-emerald-700">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-muted-foreground">{paid.length} records</p>
        </div>
      </div>

      {/* Unpaid + Pending */}
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
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...unpaid, ...pending].map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} />
                ))}
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paid.map((payout) => {
                  const worker = payout.worker_profiles as any
                  const gig = payout.gigs as any
                  return (
                    <tr key={payout.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{worker?.first_name} {worker?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{worker?.paypal_email}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{gig?.title}</td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">{formatCurrency(payout.amount)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{formatDate(payout.payout_date)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground font-mono text-xs">{payout.payout_reference || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(!payouts || payouts.length === 0) && (
        <div className="card card-body text-center py-16 text-muted-foreground">
          No payout records yet. They&apos;ll appear here after gigs are approved.
        </div>
      )}
    </div>
  )
}
