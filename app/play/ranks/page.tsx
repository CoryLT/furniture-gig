import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/shared/Nav'
import RankEmblem from '@/components/play/RankEmblem'
import { ArrowLeft, Check } from 'lucide-react'

// Live data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Ranks by total (all-time) profit — same ladder the dashboard uses.
const TIERS: { min: number; title: string; blurb: string }[] = [
  { min: 0, title: 'Rookie', blurb: "Where everyone starts. You're on the board the moment you add your first piece." },
  { min: 250, title: 'Flipper', blurb: 'A couple of solid flips and you’re officially in the game.' },
  { min: 1000, title: 'Heavy Hitter', blurb: 'You’re flipping regularly now and the profit is adding up.' },
  { min: 2500, title: 'Expert', blurb: 'Your eye for good deals is clearly paying off.' },
  { min: 10000, title: 'Mogul', blurb: 'This isn’t a hobby anymore — it’s a real business.' },
  { min: 25000, title: 'Tycoon', blurb: 'The top rank. You run this town.' },
]

const C = {
  ink: 'var(--play-ink)',
  muted: 'var(--play-muted)',
  gold: 'var(--play-gold)',
  goldLite: 'var(--play-gold-lite)',
  green: 'var(--play-green)',
  panel: 'var(--play-panel)',
  border: 'var(--play-border)',
}

const n = (v: any) => Number(v ?? 0)
const money = (v: number) =>
  (v < 0 ? '\u2212$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US')

export default async function RanksPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  // Nav names (mirrors /play).
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

  // All-time profit, computed exactly like the dashboard: each sold piece's
  // sale price minus its total cost from the ledger.
  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('id, stage, sale_price')
    .eq('owner_user_id', me)
  const { data: costRaw } = await supabase
    .from('piece_costs')
    .select('piece_id, total_cost')
    .eq('owner_user_id', me)
  const costByPiece: Record<string, number> = {}
  for (const c of (costRaw ?? []) as any[]) costByPiece[c.piece_id] = Number(c.total_cost)

  const total = ((piecesRaw ?? []) as any[])
    .filter((p) => p.stage === 'sold')
    .reduce((s, p) => s + (n(p.sale_price) - (costByPiece[p.id] ?? 0)), 0)

  let tierIdx = 0
  for (let i = 0; i < TIERS.length; i++) if (total >= TIERS[i].min) tierIdx = i

  return (
    <div style={{ minHeight: '100vh', background: 'var(--play-bg)' }}>
      <Nav role="flipper" userName={navName} userUsername={navUsername} />
      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link
          href="/play"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: C.gold }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <header className="space-y-2">
          <h1 className="font-serif text-2xl" style={{ color: C.ink }}>
            Ranks
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
            Your rank is your <span style={{ color: C.goldLite }}>all-time profit</span> — every
            dollar you’ve cleared on pieces you’ve sold (sale price minus everything that piece
            cost you). Sell pieces for more than they cost and you climb the ladder.
          </p>
          <p className="text-sm" style={{ color: C.muted }}>
            You’ve cleared{' '}
            <span className="font-mono font-bold" style={{ color: C.gold }}>
              {money(total)}
            </span>{' '}
            so far.
          </p>
        </header>

        <ol className="space-y-3">
          {TIERS.map((t, i) => {
            const state = i === tierIdx ? 'current' : i < tierIdx ? 'achieved' : 'locked'
            const earned = i < tierIdx
            const here = i === tierIdx
            const toGo = Math.max(0, t.min - total)
            return (
              <li
                key={t.title}
                className="flex items-center gap-4 rounded-2xl px-4 py-4"
                style={{
                  background: C.panel,
                  border: `1px solid ${here ? C.gold : C.border}`,
                }}
              >
                <div className="shrink-0">
                  <RankEmblem index={i} size={56} state={state} idSuffix={`ranks-${i}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-sm font-bold uppercase tracking-wide" style={{ color: here ? C.gold : C.ink }}>
                      {t.title}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: C.muted }}>
                    {t.blurb}
                  </p>
                  <p className="mt-1 font-sans text-xs" style={{ color: C.muted }}>
                    {i === 0 ? 'The starting line' : `Reach ${money(t.min)} all-time profit`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {earned ? (
                    <span className="inline-flex items-center gap-1 font-sans text-xs font-semibold" style={{ color: C.green }}>
                      <Check className="w-3.5 h-3.5" /> Earned
                    </span>
                  ) : here ? (
                    <span className="font-sans text-xs font-semibold" style={{ color: C.ink }}>
                      You’re here
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-bold" style={{ color: C.gold }}>
                      {money(toGo)} to go
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </main>
    </div>
  )
}
