import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// Records reflect live payment data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProfileRow = {
  user_id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
}

// Same name-resolution rule as the crew page: full_name first, then
// first+last, then username, then a safe fallback.
function displayName(p?: ProfileRow): string {
  if (!p) return 'Worker'
  const full = (p.full_name ?? '').trim()
  if (full) return full
  const fl = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (fl) return fl
  if (p.username) return p.username
  return 'Worker'
}

// Federal 1099-NEC reporting threshold by tax year.
// $600 through 2025; raised to $2,000 for payments made in 2026+ under the
// One Big Beautiful Bill Act (signed 2025). Verified June 2026.
function threshold(year: number): number {
  return year >= 2026 ? 2000 : 600
}

const methodLabel: Record<string, string> = {
  cashapp: 'Cash App',
  venmo: 'Venmo',
  paypal: 'PayPal',
  zelle: 'Zelle',
  cash: 'Cash',
  other: 'Other',
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = user!.id

  // Every payment I actually marked paid (not just approved/pending).
  const { data: payRaw } = await supabase
    .from('gig_payments')
    .select('worker_user_id, amount, method, marked_paid_at, gig_id')
    .eq('flipper_user_id', me)
    .not('marked_paid_at', 'is', null)
  const payments = (payRaw ?? []) as {
    worker_user_id: string | null
    amount: number | null
    method: string | null
    marked_paid_at: string
    gig_id: string | null
  }[]

  // Which tax years have data? Always include the current year.
  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>([currentYear])
  for (const p of payments) yearsSet.add(new Date(p.marked_paid_at).getFullYear())
  const years = Array.from(yearsSet).sort((a, b) => b - a)

  const selectedYear = Number(searchParams.year) || currentYear
  const inYear = payments.filter(
    (p) => new Date(p.marked_paid_at).getFullYear() === selectedYear
  )

  // Names + gig titles for the rows in this year.
  const workerIds = Array.from(
    new Set(inYear.map((p) => p.worker_user_id).filter(Boolean))
  ) as string[]
  const gigIds = Array.from(
    new Set(inYear.map((p) => p.gig_id).filter(Boolean))
  ) as string[]

  const { data: profRaw } = workerIds.length
    ? await supabase
        .from('worker_profiles')
        .select('user_id, full_name, first_name, last_name, username')
        .in('user_id', workerIds)
    : { data: [] as any[] }
  const profById: Record<string, ProfileRow> = {}
  for (const p of (profRaw ?? []) as ProfileRow[]) profById[p.user_id] = p

  const { data: gigRaw } = gigIds.length
    ? await supabase.from('gigs').select('id, title').in('id', gigIds)
    : { data: [] as any[] }
  const gigTitleById: Record<string, string> = {}
  for (const g of (gigRaw ?? []) as { id: string; title: string }[]) {
    gigTitleById[g.id] = g.title
  }

  // Group payments by worker.
  type Line = { date: string; gig: string; method: string; amount: number }
  const byWorker: Record<string, { total: number; lines: Line[] }> = {}
  for (const p of inYear) {
    const wid = p.worker_user_id ?? 'unknown'
    if (!byWorker[wid]) byWorker[wid] = { total: 0, lines: [] }
    const amt = Number(p.amount ?? 0)
    byWorker[wid].total += amt
    byWorker[wid].lines.push({
      date: new Date(p.marked_paid_at).toLocaleDateString(),
      gig: (p.gig_id && gigTitleById[p.gig_id]) || 'Gig',
      method: (p.method && methodLabel[p.method]) || '—',
      amount: amt,
    })
  }

  const th = threshold(selectedYear)
  const workers = Object.keys(byWorker)
    .map((id) => ({
      workerId: id,
      name: displayName(profById[id]),
      username: profById[id]?.username ?? null,
      total: byWorker[id].total,
      lines: byWorker[id].lines.sort((a, b) => (a.date < b.date ? -1 : 1)),
      flag: byWorker[id].total >= th,
    }))
    .sort((a, b) => b.total - a.total)

  const grandTotal = workers.reduce((s, w) => s + w.total, 0)
  const flagged = workers.filter((w) => w.flag).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">Payment Records</h1>
        <p className="text-muted-foreground mt-1">
          What you paid each worker, by year — for your own books and tax time.
        </p>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {years.map((y) => (
          <Link
            key={y}
            href={`/flipper/records?year=${y}`}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              y === selectedYear
                ? 'bg-accent text-accent-foreground border-accent'
                : 'border-border text-foreground hover:bg-muted'
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {workers.length === 0 ? (
        <div className="card card-body text-center py-16 space-y-2">
          <p className="text-lg text-muted-foreground">
            No payments recorded for {selectedYear}.
          </p>
          <p className="text-sm text-muted-foreground">
            Payments show up here once you mark a gig paid.
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="card card-body flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Total paid in {selectedYear}</p>
              <p className="text-2xl font-semibold text-foreground">
                ${grandTotal.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Workers paid</p>
              <p className="text-2xl font-semibold text-foreground">{workers.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                At/over ${th.toLocaleString()} (likely 1099)
              </p>
              <p className="text-2xl font-semibold text-foreground">{flagged}</p>
            </div>
          </div>

          {/* Per-worker breakdown */}
          <div className="space-y-4">
            {workers.map((w) => (
              <div key={w.workerId} className="card card-body space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{w.name}</p>
                      {w.username && (
                        <Link
                          href={`/u/${w.username}`}
                          className="text-sm text-accent hover:underline"
                        >
                          @{w.username}
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {w.lines.length} payment{w.lines.length === 1 ? '' : 's'} · $
                      {w.total.toFixed(2)} total
                    </p>
                  </div>
                  {w.flag && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/30">
                      Likely needs a 1099
                    </span>
                  )}
                </div>

                <div className="border-t border-border pt-3 space-y-1.5">
                  {w.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {l.date} · {l.gig} · {l.method}
                      </span>
                      <span className="text-foreground font-medium shrink-0">
                        ${l.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            This shows payments you marked paid through FlipWork; it may not include cash or
            off-app payments you never logged here. The 1099 flag uses the federal 1099-NEC
            threshold for {selectedYear} (${th.toLocaleString()}); state rules can differ.
            FlipWork isn&apos;t an accountant — confirm anything tax-related with a professional.
          </p>
        </>
      )}
    </div>
  )
}
