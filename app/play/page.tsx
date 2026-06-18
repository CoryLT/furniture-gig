import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/shared/Nav'
import CountUp from '@/components/play/CountUp'
import GameBar from '@/components/play/GameBar'
import RankEmblem from '@/components/play/RankEmblem'
import RankTrail from '@/components/play/RankTrail'
import EnableNotificationsButton from '@/components/notifications/EnableNotificationsButton'
import AddToHomeScreenPrompt from '@/components/notifications/AddToHomeScreenPrompt'
import UnreadMessagesCard from '@/components/home/UnreadMessagesCard'
import BusinessSetupCard from '../home/BusinessSetupCard'
import type { ReactNode } from 'react'
import { ImageIcon, ArrowRight, TrendingUp, TrendingDown, Coins, Lock, Target, Check } from 'lucide-react'

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
  { min: 0, title: 'Rookie' },
  { min: 250, title: 'Flipper' },
  { min: 1000, title: 'Heavy Hitter' },
  { min: 2500, title: 'Expert' },
  { min: 10000, title: 'Mogul' },
  { min: 25000, title: 'Tycoon' },
]

// Bespoke "workshop after dark" palette, kept local to /play so it doesn't
// touch the rest of the app's light theme.
const C = {
  cream: 'var(--play-ink)',
  muted: 'var(--play-muted)',
  gold: 'var(--play-gold)',
  goldDeep: 'var(--play-gold-deep)',
  goldLite: 'var(--play-gold-lite)',
  green: 'var(--play-green)',
  red: 'var(--play-red)',
  panel: 'var(--play-panel)',
  panelBorder: 'var(--play-border)',
}

// Subtle film grain so the dark background reads as textured, not flat black.
const GRAIN =
  'data:image/svg+xml,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
  )

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

  // Business profile for the Business Setup card (carried over from the old dashboard).
  const { data: businessProfile } = await supabase
    .from('business_profiles')
    .select(
      'business_name, structure, business_state, ein, bank_name, bookkeeping_tool, contractor_paperwork_ready'
    )
    .eq('user_id', me)
    .maybeSingle()

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
  const soldThisMonth = sold.filter((p: any) => {
    if (!p.stage_sold_at) return false
    const d = new Date(p.stage_sold_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthProfit = soldThisMonth.reduce((s, p) => s + p.realized, 0)
  const monthFlips = soldThisMonth.length

  // Climb chart: profit realized per month over the last 6 months.
  const climbMonths: { label: string; profit: number }[] = []
  const climbIdx: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    climbIdx[`${d.getFullYear()}-${d.getMonth()}`] = climbMonths.length
    climbMonths.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), profit: 0 })
  }
  for (const p of sold as any[]) {
    if (!p.stage_sold_at) continue
    const d = new Date(p.stage_sold_at)
    const idx = climbIdx[`${d.getFullYear()}-${d.getMonth()}`]
    if (idx !== undefined) climbMonths[idx].profit += p.realized
  }
  const maxClimb = Math.max(1, ...climbMonths.map((m) => Math.max(0, m.profit)))
  const showClimb = sold.length > 0

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

  // Monthly challenges — short-term, resettable quests on top of the rank ladder.
  // Targets are easy to tweak.
  const FLIP_GOAL = 2
  const PROFIT_GOAL = 250
  const challenges = [
    {
      key: 'flips',
      href: '/flipper/pipeline',
      icon: <Target className="w-4 h-4" />,
      title: `Flip ${FLIP_GOAL} this month`,
      label: `${Math.min(monthFlips, FLIP_GOAL)} / ${FLIP_GOAL}`,
      pct: Math.min(100, (monthFlips / FLIP_GOAL) * 100),
      done: monthFlips >= FLIP_GOAL,
    },
    {
      key: 'profit',
      href: '/books/sale/new',
      icon: <Coins className="w-4 h-4" />,
      title: `Clear $${whole(PROFIT_GOAL)} this month`,
      label: `$${whole(Math.max(0, monthProfit))} / $${whole(PROFIT_GOAL)}`,
      pct: Math.min(100, Math.max(0, (monthProfit / PROFIT_GOAL) * 100)),
      done: monthProfit >= PROFIT_GOAL,
    },
  ]

  const byStage = (k: Stage) => pieces.filter((p) => p.stage === k)
  const hasPieces = pieces.length > 0

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--play-bg)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ backgroundImage: `url("${GRAIN}")`, opacity: 0.04, mixBlendMode: 'overlay', zIndex: 0 }}
      />
      <Nav role="flipper" userName={navName} userUsername={navUsername} />
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero: rank emblem, glowing score, XP bar */}
        <section className="relative text-center pt-2">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
            style={{
              width: 340,
              height: 300,
              zIndex: -1,
              background:
                'radial-gradient(circle at 50% 32%, rgba(245,158,11,0.16), rgba(245,158,11,0) 68%)',
            }}
          />
          <div className="flex flex-col items-center">
            <RankEmblem index={tierIdx} size={78} state="current" idSuffix="hero" />
            <span
              className="mt-2 font-sans text-[11px] font-bold uppercase tracking-[0.22em]"
              style={{ color: C.gold }}
            >
              {tier.title}
            </span>
          </div>

          <div
            className="mt-4 font-mono font-bold leading-none"
            style={{
              fontSize: 'clamp(3rem, 14vw, 5rem)',
              backgroundImage: `linear-gradient(180deg, ${C.goldLite} 0%, ${C.gold} 55%, ${C.goldDeep} 100%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 3px 18px rgba(245,158,11,0.45))',
            }}
          >
            <CountUp value={total} />
          </div>
          <div
            className="mt-2 font-sans text-[11px] uppercase tracking-[0.3em]"
            style={{ color: C.muted }}
          >
            profit so far
          </div>

          {monthProfit > 0 ? (
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold"
              style={{
                color: C.green,
                background: 'rgba(103,211,145,0.12)',
                border: '1px solid rgba(103,211,145,0.25)',
              }}
            >
              <TrendingUp className="w-4 h-4" /> {money(monthProfit)} this month
            </div>
          ) : monthProfit < 0 ? (
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold"
              style={{
                color: C.red,
                background: 'rgba(240,145,127,0.12)',
                border: '1px solid rgba(240,145,127,0.25)',
              }}
            >
              <TrendingDown className="w-4 h-4" /> {money(monthProfit)} this month
            </div>
          ) : (
            <div className="mt-4 font-sans text-sm" style={{ color: C.muted }}>
              Sell a piece to start the climb
            </div>
          )}

          <div className="mt-6 max-w-xs mx-auto">
            <GameBar pct={pct} />
            <div className="mt-2 font-sans text-xs" style={{ color: C.muted }}>
              {next ? (
                <>
                  {money(toNext)} to{' '}
                  <span className="font-semibold" style={{ color: C.goldLite }}>
                    {next.title}
                  </span>
                </>
              ) : (
                'Top rank — you run this town'
              )}
            </div>
          </div>

          {/* Rank trail — medallions; tap or hover one to see what it takes */}
          <RankTrail
            tiers={TIERS}
            tierIdx={tierIdx}
            total={total}
            colors={{
              gold: C.gold,
              muted: C.muted,
              cream: C.cream,
              green: C.green,
              panelBorder: C.panelBorder,
            }}
          />

          <div
            className="mt-5 flex items-center justify-center gap-5 font-mono text-sm"
            style={{ color: C.cream }}
          >
            <span>
              <span style={{ color: C.gold }}>{sold.length}</span>{' '}
              <span
                className="font-sans text-xs uppercase tracking-wider"
                style={{ color: C.muted }}
              >
                flipped
              </span>
            </span>
            <span style={{ color: C.panelBorder }}>|</span>
            <span>
              <span style={{ color: C.gold }}>{unsold.length}</span>{' '}
              <span
                className="font-sans text-xs uppercase tracking-wider"
                style={{ color: C.muted }}
              >
                in play
              </span>
            </span>
          </div>
        </section>

        {/* Profit by month — the score, climbing */}
        {showClimb && (
          <section>
            <h2 className="font-serif text-lg mb-2" style={{ color: C.cream }}>
              Profit by month
            </h2>
            <div
              className="rounded-2xl p-5"
              style={{ background: C.panel, border: `1px solid ${C.panelBorder}` }}
            >
              <div className="flex items-end gap-3 h-32">
                {climbMonths.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                    <div className="flex-1 w-full flex items-end justify-center">
                      <div
                        className="w-5 rounded-t"
                        style={{
                          height: `${(Math.max(0, m.profit) / maxClimb) * 100}%`,
                          minHeight: m.profit > 0 ? 3 : 0,
                          background: C.green,
                        }}
                        title={`${m.label}: ${money(m.profit)}`}
                      />
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: C.muted }}>
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Challenges — your next goals to chase */}
        <section>
          <h2 className="font-serif text-lg mb-2" style={{ color: C.cream }}>
            Challenges
          </h2>
          <div className="space-y-2">
            {challenges.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="block rounded-2xl p-4"
                style={{
                  background: C.panel,
                  border: `1px solid ${c.done ? 'rgba(103,211,145,0.4)' : C.panelBorder}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0" style={{ color: c.done ? C.green : C.gold }}>
                      {c.icon}
                    </span>
                    <span
                      className="font-sans text-sm font-medium truncate"
                      style={{ color: C.cream }}
                    >
                      {c.title}
                    </span>
                  </div>
                  {c.done ? (
                    <span
                      className="inline-flex items-center gap-1 font-sans text-xs font-bold uppercase tracking-wider shrink-0"
                      style={{ color: C.green }}
                    >
                      <Check className="w-3.5 h-3.5" /> Done
                    </span>
                  ) : (
                    <span className="font-mono text-xs shrink-0" style={{ color: C.muted }}>
                      {c.label}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <GameBar pct={c.pct} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Cash free vs tied up — HUD resource counters */}
        <section className="grid grid-cols-2 gap-3">
          <Stat
            icon={<Coins className="w-3.5 h-3.5" style={{ color: C.gold }} />}
            label="Cash free"
            value={money(cashFree)}
            hint="ready for the next find"
          />
          <Stat
            icon={<Lock className="w-3.5 h-3.5" style={{ color: C.gold }} />}
            label="Tied up"
            value={money(tiedUp)}
            hint="riding in pieces you hold"
          />
        </section>

        {/* The board — your pieces as game tokens */}
        {hasPieces ? (
          <section className="space-y-5">
            {STAGES.map((s) => {
              const items = byStage(s.key)
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="font-serif text-lg" style={{ color: C.cream }}>
                      {s.label}
                    </h2>
                    <span className="font-mono text-xs" style={{ color: C.muted }}>
                      {items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <div
                      className="rounded-xl px-4 py-4 font-sans text-sm"
                      style={{ border: `1px dashed ${C.panelBorder}`, color: C.muted }}
                    >
                      Nothing here yet.
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
          <section
            className="rounded-2xl p-8 text-center"
            style={{ background: C.panel, border: `1px solid ${C.panelBorder}` }}
          >
            <p className="font-serif text-lg" style={{ color: C.cream }}>
              Your board is empty.
            </p>
            <p className="mt-1 font-sans text-sm" style={{ color: C.muted }}>
              Add your first piece in the Pipeline — watch it move across and the score
              climb as you sell.
            </p>
          </section>
        )}

        <div className="text-center pt-1">
          <Link
            href="/flipper/pipeline"
            className="inline-flex items-center gap-1 font-sans text-sm hover:underline"
            style={{ color: C.goldLite }}
          >
            Open the full Pipeline <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Carried over from the old dashboard */}
        <UnreadMessagesCard />
        <BusinessSetupCard userId={me} initial={businessProfile as any} mode="dashboard" />
        <EnableNotificationsButton />
        <AddToHomeScreenPrompt />
      </main>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon?: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-wider"
        style={{ color: C.muted }}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-mono text-2xl font-bold" style={{ color: C.cream }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 font-sans text-xs" style={{ color: C.muted }}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function PieceCard({ p }: { p: PieceVM }) {
  const sold = p.stage === 'sold'
  const scoreText = sold
    ? (p.realized >= 0 ? '+$' : '\u2212$') + whole(p.realized)
    : p.target_price
      ? '\u2192 $' + whole(n(p.target_price))
      : '$' + whole(p.costs) + ' in'
  const scoreColor = sold
    ? p.realized >= 0
      ? C.green
      : C.red
    : p.target_price
      ? C.gold
      : C.muted
  return (
    <div
      className="w-32 shrink-0 rounded-xl overflow-hidden"
      style={{ background: C.panel, border: `1px solid ${C.panelBorder}` }}
    >
      <div
        className="aspect-square w-full overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.25)' }}
      >
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-6 h-6" style={{ color: 'rgba(169,158,140,0.5)' }} />
        )}
      </div>
      <div className="px-2 py-2">
        <div className="font-sans text-xs font-medium truncate" style={{ color: C.cream }}>
          {p.title}
        </div>
        <div className="font-mono text-xs font-bold" style={{ color: scoreColor }}>
          {scoreText}
        </div>
      </div>
    </div>
  )
}
