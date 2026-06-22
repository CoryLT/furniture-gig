'use client'

import { useState } from 'react'

type Month = { label: string; income: number; expense: number }

function money(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function MonthlyBars({ months }: { months: Month[] }) {
  const [sel, setSel] = useState(months.length - 1)
  if (months.length === 0) return null

  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)))
  const m = months[Math.min(Math.max(sel, 0), months.length - 1)]
  const net = m.income - m.expense

  return (
    <div className="rounded-xl border border-border p-5">
      {/* Readout for the selected month */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground">{m.label}</span>
        <span className="text-xs text-muted-foreground">
          In <span className="font-medium text-green-600">{money(m.income)}</span>
          {' · '}Out <span className="font-medium text-red-600">{money(m.expense)}</span>
          {' · '}Net{' '}
          <span className={'font-medium ' + (net < 0 ? 'text-red-600' : 'text-foreground')}>
            {money(net)}
          </span>
        </span>
      </div>

      <div className="flex items-end gap-3 h-36">
        {months.map((mm, i) => {
          const active = i === sel
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              aria-label={`${mm.label}: in ${money(mm.income)}, out ${money(mm.expense)}`}
              className={
                'flex-1 flex flex-col items-center gap-1.5 h-full rounded-md px-0.5 transition-colors ' +
                (active ? 'bg-muted' : 'hover:bg-muted/50')
              }
            >
              <div className="flex items-end justify-center gap-1 w-full flex-1">
                <div
                  className="w-3 rounded-t bg-green-500"
                  style={{ height: `${(mm.income / maxBar) * 100}%` }}
                />
                <div
                  className="w-3 rounded-t bg-red-400"
                  style={{ height: `${(mm.expense / maxBar) * 100}%` }}
                />
              </div>
              <span className={'text-[10px] ' + (active ? 'text-foreground' : 'text-muted-foreground')}>
                {mm.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> In
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Out
        </span>
        <span className="ml-auto">Tap a month for its totals</span>
      </div>
    </div>
  )
}
