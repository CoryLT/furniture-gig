'use client'

import { useState } from 'react'
import Link from 'next/link'

// One combined money card. A tab toggle flips between two views that share the
// same period filter and bar style:
//   • Sales & expenses — money in vs money out, profit, where money went
//   • Owner money       — net put in / taken out (draws vs contributions)
// Plain Tailwind bars, no charting library (matches the rest of the app).

type Month = {
  ym: string
  label: string
  income: number
  expense: number
  contributions: number
  draws: number
}
type Cat = { ym: string; name: string; amount: number }

function money(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

type Tab = 'flow' | 'owner'
type Period = 'year' | '12mo' | 'all'

export default function MoneyOverview({ months, expenseCats }: { months: Month[]; expenseCats: Cat[] }) {
  const [tab, setTab] = useState<Tab>('flow')
  const [period, setPeriod] = useState<Period>('year')
  const [sel, setSel] = useState<number | null>(null)

  const thisYear = String(new Date().getFullYear())
  const inPeriod = (ym: string, i: number, n: number) =>
    period === 'all' ? true : period === 'year' ? ym.startsWith(thisYear) : i >= n - 12

  const filtered = months.filter((m, i) => inPeriod(m.ym, i, months.length))
  const keptYms = new Set(filtered.map((m) => m.ym))

  // Totals for the selected period + tab.
  const totalIncome = filtered.reduce((a, m) => a + m.income, 0)
  const totalExpense = filtered.reduce((a, m) => a + m.expense, 0)
  const profit = totalIncome - totalExpense
  const totalIn = filtered.reduce((a, m) => a + m.contributions, 0)
  const totalOut = filtered.reduce((a, m) => a + m.draws, 0)
  const net = totalIn - totalOut

  // Which two series the bars show, by tab.
  const greenOf = (m: Month) => (tab === 'flow' ? m.income : m.contributions)
  const redOf = (m: Month) => (tab === 'flow' ? m.expense : m.draws)
  const maxBar = Math.max(1, ...filtered.map((m) => Math.max(greenOf(m), redOf(m))))
  const selIdx = sel === null ? null : Math.min(Math.max(sel, 0), filtered.length - 1)
  const selMonth = selIdx === null ? null : filtered[selIdx]

  // Top expense categories for the period (Sales & expenses tab only).
  const catTotals = new Map<string, number>()
  for (const c of expenseCats) if (keptYms.has(c.ym)) catTotals.set(c.name, (catTotals.get(c.name) || 0) + c.amount)
  const topCats = [...catTotals.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxCat = Math.max(1, ...topCats.map(([, v]) => v))

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(t)
        setSel(null)
      }}
      className={
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
        (tab === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50')
      }
    >
      {label}
    </button>
  )
  const chip = (p: Period, label: string) => (
    <button
      type="button"
      onClick={() => {
        setPeriod(p)
        setSel(null)
      }}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (period === p ? 'bg-accent text-accent-foreground' : 'border border-border text-muted-foreground hover:bg-muted')
      }
    >
      {label}
    </button>
  )

  return (
    <div className="rounded-xl border border-border p-5">
      {/* Tabs + period filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-muted/40 p-0.5">
          {tabBtn('flow', 'Sales & expenses')}
          {tabBtn('owner', 'Owner money')}
        </div>
        <div className="flex gap-1.5">
          {chip('year', 'This year')}
          {chip('12mo', 'Last 12 mo')}
          {chip('all', 'All time')}
        </div>
      </div>

      {/* Totals */}
      {tab === 'flow' ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Money in</div>
            <div className="mt-0.5 text-2xl font-semibold text-green-600">{money(totalIncome)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Money out</div>
            <div className="mt-0.5 text-2xl font-semibold text-red-600">{money(totalExpense)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Profit</div>
            <div className={'mt-0.5 text-2xl font-semibold ' + (profit < 0 ? 'text-red-600' : 'text-foreground')}>
              {money(profit)}
            </div>
          </div>
        </div>
      ) : (
        <>
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
              <div className="text-[11px] text-muted-foreground">Total moved in</div>
              <div className="mt-0.5 text-lg font-medium text-green-600">{money(totalIn)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Total moved out</div>
              <div className="mt-0.5 text-lg font-medium text-red-600">{money(totalOut)}</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Moved in/out count every transfer, including money you shuffle between your own accounts, so
            they run high. <span className="font-medium text-foreground">Net</span> is what you've truly
            put in or taken out on balance.
          </p>
        </>
      )}

      {filtered.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">Nothing in this period yet.</p>
      ) : (
        <>
          {/* Hover/tap readout */}
          <div className="mt-5 mb-2 h-4 text-xs text-muted-foreground">
            {selMonth ? (
              <span>
                <span className="font-medium text-foreground">{selMonth.label}</span>
                {' · '}
                {tab === 'flow' ? 'In ' : 'In '}
                <span className="font-medium text-green-600">{money(greenOf(selMonth))}</span>
                {' · '}
                {tab === 'flow' ? 'Out ' : 'Out '}
                <span className="font-medium text-red-600">{money(redOf(selMonth))}</span>
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
                  aria-label={`${m.label}: in ${money(greenOf(m))}, out ${money(redOf(m))}`}
                  className={
                    'flex-1 flex flex-col items-center gap-1.5 h-full rounded-md px-0.5 transition-colors ' +
                    (active ? 'bg-muted' : 'hover:bg-muted/50')
                  }
                >
                  <div className="flex items-end justify-center gap-1 w-full flex-1">
                    <div className="w-3 rounded-t bg-green-500" style={{ height: `${(greenOf(m) / maxBar) * 100}%` }} />
                    <div className="w-3 rounded-t bg-red-400" style={{ height: `${(redOf(m) / maxBar) * 100}%` }} />
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
              <span className="inline-block h-2 w-2 rounded-sm bg-green-500" />{' '}
              {tab === 'flow' ? 'Money in (sales)' : 'Put in (contributions)'}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-400" />{' '}
              {tab === 'flow' ? 'Money out (expenses)' : 'Took out (draws)'}
            </span>
          </div>

          {/* Where money went — Sales & expenses tab only */}
          {tab === 'flow' && topCats.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-xs text-muted-foreground mb-3">Where money went</div>
              <div className="space-y-3">
                {topCats.map(([name, amount]) => (
                  <div key={name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground truncate pr-2">{name}</span>
                      <span className="text-muted-foreground shrink-0">{money(amount)}</span>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className="h-2 rounded bg-accent" style={{ width: `${(amount / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Owner-money quick links */}
      {tab === 'owner' && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/books/cash/new" className="text-sm font-medium text-green-700 hover:text-green-800">
            + Add contribution
          </Link>
          <Link href="/books/tax" className="text-sm font-medium text-green-700 hover:text-green-800">
            Tax year →
          </Link>
        </div>
      )}
    </div>
  )
}
