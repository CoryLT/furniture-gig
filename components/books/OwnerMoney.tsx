'use client'

import { useState } from 'react'
import Link from 'next/link'

// Owner money: how much you've put INTO the business (contributions) vs taken
// OUT for yourself (draws), by month, with a period filter. Mirrors the look of
// app/books/MonthlyBars.tsx (plain Tailwind bars, no charting library).

type Month = { ym: string; label: string; contributions: number; draws: number }

function money(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

type Period = 'all' | 'year' | '12mo'

export default function OwnerMoney({ months }: { months: Month[] }) {
  const [period, setPeriod] = useState<Period>('year')
  const [sel, setSel] = useState<number | null>(null)

  const thisYear = String(new Date().getFullYear())
  const filtered =
    period === 'all'
      ? months
      : period === 'year'
      ? months.filter((m) => m.ym.startsWith(thisYear))
      : months.slice(-12)

  const totalIn = filtered.reduce((a, m) => a + m.contributions, 0)
  const totalOut = filtered.reduce((a, m) => a + m.draws, 0)
  const net = totalIn - totalOut

  const maxBar = Math.max(1, ...filtered.map((m) => Math.max(m.contributions, m.draws)))
  const selIdx = sel === null ? null : Math.min(Math.max(sel, 0), filtered.length - 1)
  const selMonth = selIdx === null ? null : filtered[selIdx]

  const chip = (p: Period, label: string) => (
    <button
      type="button"
      onClick={() => {
        setPeriod(p)
        setSel(null)
      }}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (period === p
          ? 'bg-accent text-accent-foreground'
          : 'border border-border text-muted-foreground hover:bg-muted')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Owner money
        </h2>
        <div className="flex gap-1.5">
          {chip('year', 'This year')}
          {chip('12mo', 'Last 12 mo')}
          {chip('all', 'All time')}
        </div>
      </div>

      {/* Net is the number to trust; gross in/out run high because money moved
          between your own accounts counts on both sides. */}
      <div className="mt-4">
        <div className="text-xs text-muted-foreground">
          {net >= 0 ? 'Net put into the business' : 'Net taken out of the business'}
        </div>
        <div className={'mt-0.5 text-3xl font-semibold ' + (net < 0 ? 'text-red-600' : 'text-foreground')}>
          {money(Math.abs(net))}
        </div>
      </div>

      <div className="mt-3 flex gap-6">
        <div>
          <div className="text-[11px] text-muted-foreground">Money in</div>
          <div className="mt-0.5 text-lg font-medium text-green-600">{money(totalIn)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Money out</div>
          <div className="mt-0.5 text-lg font-medium text-red-600">{money(totalOut)}</div>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Money in and out include transfers between your own accounts, so they run high.
        The <span className="font-medium text-foreground">Net</span> is the number that reflects what you've really put in or taken out.
      </p>

      {filtered.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          No owner draws or contributions in this period yet.
        </p>
      ) : (
        <>
          {/* Hover/tap readout */}
          <div className="mt-5 mb-2 h-4 text-xs text-muted-foreground">
            {selMonth ? (
              <span>
                <span className="font-medium text-foreground">{selMonth.label}</span>
                {' · '}In <span className="font-medium text-green-600">{money(selMonth.contributions)}</span>
                {' · '}Out <span className="font-medium text-red-600">{money(selMonth.draws)}</span>
              </span>
            ) : (
              <span>Hover a month for its detail</span>
            )}
          </div>

          <div className="flex items-end gap-2 h-32">
            {filtered.map((m, i) => {
              const active = i === selIdx
              return (
                <button
                  key={m.ym}
                  type="button"
                  onClick={() => setSel(i)}
                  onMouseEnter={() => setSel(i)}
                  onMouseLeave={() => setSel(null)}
                  aria-label={`${m.label}: put in ${money(m.contributions)}, took out ${money(m.draws)}`}
                  className={
                    'flex-1 flex flex-col items-center gap-1.5 h-full rounded-md px-0.5 transition-colors ' +
                    (active ? 'bg-muted' : 'hover:bg-muted/50')
                  }
                >
                  <div className="flex items-end justify-center gap-1 w-full flex-1">
                    <div
                      className="w-3 rounded-t bg-green-500"
                      style={{ height: `${(m.contributions / maxBar) * 100}%` }}
                    />
                    <div
                      className="w-3 rounded-t bg-red-400"
                      style={{ height: `${(m.draws / maxBar) * 100}%` }}
                    />
                  </div>
                  <span className={'text-[10px] ' + (active ? 'text-foreground' : 'text-muted-foreground')}>
                    {m.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-green-500" /> Put in (contributions)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-400" /> Took out (draws)
            </span>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/books/cash/new" className="text-sm font-medium text-green-700 hover:text-green-800">
          + Add contribution
        </Link>
        <Link href="/books/tax" className="text-sm font-medium text-green-700 hover:text-green-800">
          Tax year →
        </Link>
      </div>
    </div>
  )
}
