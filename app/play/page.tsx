import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/shared/Nav'
import CountUp from '@/components/play/CountUp'
import { ImageIcon, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'

// Live data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Stage = 'sourced' | 'in_progress' | 'listed' | 'sold'

const STAGES: { key: Stage; label: string }[] = [
  { key: 'sourced', label: 'Sourced' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'listed', label: 'Listed' },
  { key: 'sold', label: 'Sold' },
]

// Ranks by total profit — turns the lifetime number into a level you climb.
// Easy to rename or re-space these later.
const TIERS: { min: number; title: string }[] = [
  { min: 0, title: 'Picker' },
  { min: 250, title: 'Flipper' },
  { min: 1000, title: 'Dealer' },
  { min: 2500, title: 'Operator' },
  { min: 5000, title: 'Closer' },
  { min: 10000, title: 'Mogul' },
  { min: 25000, title: 'Tycoon' },
]

const n = (v: any) => Number(v ?? 0)
function money(v: number): string {
  const neg = v < 0
  return (
    (neg ? '\u2212$' : '$') +
    Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}
const whole = (v: number) => Math.round(Math.abs(v)).toLocaleString('en-US')

type PieceVM = {
  id: string
  title: string
  stage: Stage
  imageUrl: string | null
  target_price: number | null
  costs: number
  realized: number
}

export default async function PlayPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  // Names for the nav (mirrors /home). Note: we intentionally do NOT bounce
  // admins away — the operator (Cory) is an admin and needs this page.
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('first_name, username')
    .eq('user_id', me)
    .maybeSingle()
  const flipperProfile = (
    await supabase
      .from('flipper_profiles')
      .select('business_name, username')
      .eq('user_id', me)
      .maybeSingle()
  ).data
  const navUsername =
    (workerProfile as any)?.username || (flipperProfile as any)?.username || undefined
  const navName =
    (workerProfile as any)?.first_name ||
    (flipperProfile as any)?.business_name ||
    user.email ||
    ''

  // Pieces + their tagged expenses.
  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('id, title, stage, acquisition_cost, target_price, sale_price, image_path, sold_at, created_at')
    .eq('owner_user_id', me)
    .order('created_at', { ascending: false })
  const { data: expRaw } = await supabase
    .from('piece_expenses')
    .select('piece_id, amount')
    .eq('owner_user_id', me)

  const expByPiece: Record<string, number> = {}
  for (const e of (expRaw ?? []) as any[]) {
    expByPiece[e.piece_id] = (expByPiece[e.piece_id] ?? 0) + n(e.amount)
  }

  const pieces: PieceVM[] = ((piecesRaw ?? []) as any[]).map((p) => {
    const costs = n(p.acquisition_cost) + (expByPiece[p.id] ?? 0)
    return {
      id: p.id as string,
      title: (p.title as string) || 'Untitled piece',
      stage: ((p.stage as Stage) || 'sourced') as Stage,
      target_price: p.target_price as number | null,
      costs,
      realized: n(p.sale_price) - costs,
      imageUrl: p.image_path
        ? supabase.storage.from('marketplace-photos').getPublicUrl(p.image_path).data.publicUrl
        : null,
      stage_sold_at: p.sold_at,
    } as any
  })

  const unsold = pieces.filter((p) => p.stage !== 'sold')
  const sold = pieces.filter((p) => p.stage === 'sold')
  const tiedUp = unsold.reduce((s, p) => s + p.costs, 0)
  const allTimeProfit = sold.reduce((s, p) => s + p.realized, 0)
  const now = new Date()
  const monthProfit = sold
    .filter((p: any) => {
      if (!p.stage_sold_at) return false
      const d = new Date(p.stage_sold_at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((s, p) => s + p.realized, 0)

  // Rank / progress from total profit — the game-score framing.
  const total = allTimeProfit
  let tierIdx = 0
  for (let i = 0; i < TIERS.length; i++) if (total >= TIERS[i].min) tierIdx = i
  const tier = TIERS[tierIdx]
  const next = TIERS[tierIdx + 1] ?? null
  const toNext = next ? Math.max(0, next.min - total) : 0
  const pct = next
    ? Math.min(100, Math.max(0, ((total - tier.min) / (next.min - tier.min)) * 100))
    : 100

  // Cash free = money on hand across asset buckets (same math as Books).
  const { data: assetLines } = await supabase
    .from('entry_lines')
    .select('debit, credit, accounts!inner(type)')
    .eq('owner_user_id', me)
    .eq('accounts.type', 'asset')
  let cashFree = 0
  for (const l of (assetLines ?? []) as any[]) cashFree += Number(l.debit) - Number(l.credit)

  const byStage = (k: Stage) => pieces.filter((p) => p.stage === k)
  const hasPieces = pieces.length > 0

  return (
    <div className="min-h-screen bg-background">
      <Nav role="flipper" userName={navName} userUsername={navUsername} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero: your rank, your climbing score, your next goal */}
        <section className="rounded-2xl border border-border bg-gradient-to-b from-accent/10 to-card px-6 py-7 text-center">
          <div className="inline-flex items-center rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            {tier.title}
          </div>
          <div className="mt-3 font-serif text-5xl sm:text-6xl tracking-tight text-accent">
            <CountUp value={total} />
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            profit so far
          </div>

          {monthProfit > 0 ? (
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green-600">
              <TrendingUp className="w-4 h-4" /> {money(monthProfit)} this month
            </div>
          ) : monthProfit < 0 ? (
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-600">
              <TrendingDown className="w-4 h-4" /> {money(monthProfit)} this month
            </div>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">Sell a piece to start the climb</div>
          )}

          {/* progress to the next rank */}
          <div className="mt-4 max-w-xs mx-auto">
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {next ? (
                <>
                  {money(toNext)} to <span className="font-medium text-foreground">{next.title}</span>
                </>
              ) : (
                'Top rank reached'
              )}
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            {sold.length} flipped &middot; {unsold.length} in play
          </div>
        </section>

        {/* Cash free vs tied up */}
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Cash free" value={money(cashFree)} hint="ready to spend on the next find" />
          <Stat label="Tied up" value={money(tiedUp)} hint="riding in pieces you still hold" />
        </section>

        {/* The board */}
        {hasPieces ? (
          <section className="space-y-5">
            {STAGES.map((s) => {
              const items = byStage(s.key)
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                      {s.label}
                    </h2>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                      Nothing here right now.
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                      {items.map((p) => (
                        <PieceCard key={p.id} p={p} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-foreground font-medium">No pieces on the board yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a piece in the Pipeline and it&apos;ll show up here, with the profit
              landing as you sell.
            </p>
          </section>
        )}

        <div className="text-center pt-1">
          <Link
            href="/flipper/pipeline"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            Open the full Pipeline <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function PieceCard({ p }: { p: PieceVM }) {
  const sold = p.stage === 'sold'
  const scoreText = sold
    ? (p.realized >= 0 ? '+$' : '\u2212$') + whole(p.realized)
    : p.target_price
      ? 'target $' + whole(n(p.target_price))
      : '$' + whole(p.costs) + ' in'
  const scoreClass = sold
    ? p.realized >= 0
      ? 'text-green-600'
      : 'text-red-600'
    : 'text-muted-foreground'
  return (
    <div className="w-32 shrink-0">
      <div className="aspect-square w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="mt-1.5 text-xs font-medium text-foreground truncate">{p.title}</div>
      <div className={'text-xs font-semibold ' + scoreClass}>{scoreText}</div>
    </div>
  )
}
