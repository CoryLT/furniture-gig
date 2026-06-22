import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ExportButton from './ExportButton'
import { getPlan, isPro } from '@/lib/plan'
import ProLock from '@/components/billing/ProLock'

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
// $600 through 2025; $2,000 for 2026+ (One Big Beautiful Bill Act).
function threshold(year: number): number {
  return year >= 2026 ? 2000 : 600
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = user!.id

  const plan = await getPlan(supabase, me)
  if (!isPro(plan)) {
    return (
      <ProLock
        title="Payment records & 1099s"
        blurb="See what you paid each person by year, get a heads-up when someone crosses the 1099 threshold, and export it all. It's part of FlipWork Pro."
      />
    )
  }

  // Every worker payment = a labor expense you logged and tagged to a crew
  // member (the ledger is the one source of truth now).
  const { data: payRaw } = await supabase
    .from('worker_payments')
    .select('crew_member_id, amount, date, description')
    .eq('owner_user_id', me)
  const payments = (payRaw ?? []) as {
    crew_member_id: string
    amount: number | null
    date: string
    description: string | null
  }[]

  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>([currentYear])
  for (const p of payments) yearsSet.add(new Date(p.date).getFullYear())
  const years = Array.from(yearsSet).sort((a, b) => b - a)

  const selectedYear = Number(searchParams.year) || currentYear
  const inYear = payments.filter((p) => new Date(p.date).getFullYear() === selectedYear)

  // Resolve names from the crew roster (+ profiles for on-platform crew).
  const crewIds = Array.from(new Set(inYear.map((p) => p.crew_member_id).filter(Boolean)))
  const { data: crewRaw } = crewIds.length
    ? await supabase.from('crew_members').select('id, worker_user_id, worker_name').in('id', crewIds)
    : { data: [] as any[] }
  const crewById: Record<string, { worker_user_id: string | null; worker_name: string | null }> = {}
  for (const c of (crewRaw ?? []) as any[]) crewById[c.id] = c
  const onIds = Array.from(
    new Set(((crewRaw ?? []) as any[]).map((c) => c.worker_user_id).filter(Boolean))
  ) as string[]
  const { data: profRaw } = onIds.length
    ? await supabase
        .from('worker_profiles')
        .select('user_id, full_name, first_name, last_name, username')
        .in('user_id', onIds)
    : { data: [] as any[] }
  const profById: Record<string, ProfileRow> = {}
  for (const p of (profRaw ?? []) as ProfileRow[]) profById[p.user_id] = p

  function crewName(crewId: string): { name: string; username: string | null } {
    const c = crewById[crewId]
    if (!c) return { name: 'Worker', username: null }
    if (c.worker_user_id) {
      const prof = profById[c.worker_user_id]
      return { name: displayName(prof), username: prof?.username ?? null }
    }
    return { name: c.worker_name || 'Worker', username: null }
  }

  type Line = { date: string; note: string; amount: number }
  const byWorker: Record<string, { total: number; lines: Line[] }> = {}
  for (const p of inYear) {
    const wid = p.crew_member_id
    if (!byWorker[wid]) byWorker[wid] = { total: 0, lines: [] }
    const amt = Number(p.amount ?? 0)
    byWorker[wid].total += amt
    byWorker[wid].lines.push({
      date: new Date(p.date).toLocaleDateString(),
      note: p.description || 'Labor',
      amount: amt,
    })
  }

  const th = threshold(selectedYear)
  const workers = Object.keys(byWorker)
    .map((id) => {
      const { name, username } = crewName(id)
      return {
        crewId: id,
        name,
        username,
        total: byWorker[id].total,
        lines: byWorker[id].lines.sort((a, b) => (a.date < b.date ? -1 : 1)),
        flag: byWorker[id].total >= th,
      }
    })
    .sort((a, b) => b.total - a.total)

  const grandTotal = workers.reduce((s, w) => s + w.total, 0)
  const flagged = workers.filter((w) => w.flag).length

  const exportRows = workers.flatMap((w) =>
    w.lines.map((l) => ({
      worker: w.name,
      username: w.username ?? '',
      date: l.date,
      gig: l.note,
      method: '',
      amount: l.amount,
    }))
  )

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl text-foreground">Payment Records</h1>
          <p className="text-muted-foreground mt-1">
            What you paid each worker, by year — for your own books and tax time.
          </p>
        </div>
        {workers.length > 0 && <ExportButton year={selectedYear} rows={exportRows} />}
      </div>

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
            Payments show up here when you log a labor expense on a piece and tag who you paid.
          </p>
        </div>
      ) : (
        <>
          <div className="card card-body flex flex-wrap gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Total paid in {selectedYear}</p>
              <p className="text-2xl font-semibold text-foreground">${grandTotal.toFixed(2)}</p>
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

          <div className="space-y-4">
            {workers.map((w) => (
              <div key={w.crewId} className="card card-body space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/flipper/crew/${w.crewId}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {w.name}
                      </Link>
                      {w.username && (
                        <Link href={`/u/${w.username}`} className="text-sm text-accent hover:underline">
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
                        {l.date} · {l.note}
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

          <p className="text-xs text-muted-foreground leading-relaxed">
            This adds up the labor you logged and tagged to each worker. Labor you didn&apos;t tag to
            anyone won&apos;t appear here. The 1099 flag uses the federal 1099-NEC threshold for{' '}
            {selectedYear} (${th.toLocaleString()}); state rules can differ. FlipWork isn&apos;t an
            accountant — confirm anything tax-related with a professional.
          </p>
        </>
      )}
    </div>
  )
}
