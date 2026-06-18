'use client'

import { useState } from 'react'

type MonthAgg = { income: number; expense: number }

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Warm, mid-tone palette that reads on both the light and dark panel.
const DONUT_COLORS = [
  '#d98a2b', '#e0b94e', '#5fa776', '#c0594a',
  '#8a7a5c', '#7a9cb0', '#9c6f9e', '#b5894f',
]

function money(v: number): string {
  return (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US')
}

export default function ProfitCharts({
  byYear,
  years,
  currentYear,
  currentMonth,
  expensesByYM,
}: {
  byYear: Record<number, MonthAgg[]>
  years: number[]
  currentYear: number
  currentMonth: number
  expensesByYM: Record<string, { name: string; amount: number }[]>
}) {
  const [year, setYear] = useState<number>(
    years.includes(currentYear) ? currentYear : years[0] ?? currentYear
  )
  const [month, setMonth] = useState<number>(currentMonth)

  const months = byYear[year] ?? Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }))
  const totalIn = months.reduce((s, m) => s + m.income, 0)
  const totalOut = months.reduce((s, m) => s + m.expense, 0)
  const net = totalIn - totalOut
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)))

  const panel = { background: 'var(--play-panel)', border: '1px solid var(--play-border)' }
  const selectStyle = {
    background: 'var(--play-panel)',
    border: '1px solid var(--play-border)',
    color: 'var(--play-ink)',
  }

  // ---- Donut data for the selected month ----
  const monthExpenses = expensesByYM[`${year}-${month}`] ?? []
  const donutTotal = monthExpenses.reduce((s, c) => s + c.amount, 0)
  const TOP = 6
  const top = monthExpenses.slice(0, TOP)
  const restTotal = monthExpenses.slice(TOP).reduce((s, c) => s + c.amount, 0)
  const segments = restTotal > 0 ? [...top, { name: 'Other', amount: restTotal }] : top

  const size = 168
  const stroke = 28
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="space-y-6">
      {/* ---- Profit by month ---- */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-serif text-lg" style={{ color: 'var(--play-ink)' }}>
            Profit by month
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg px-2.5 py-1 font-mono text-sm focus:outline-none"
              style={selectStyle}
              aria-label="Month"
            >
              {MONTH_FULL.map((mn, i) => (
                <option key={i} value={i}>
                  {mn}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg px-2.5 py-1 font-mono text-sm focus:outline-none"
              style={selectStyle}
              aria-label="Year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl p-5" style={panel}>
          {/* Selected month summary */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <Summary label="In" value={money(months[month].income)} color="var(--play-green)" />
            <Summary label="Out" value={money(months[month].expense)} color="var(--play-red)" />
            <Summary
              label="Net"
              value={money(months[month].income - months[month].expense)}
              color={months[month].income - months[month].expense < 0 ? 'var(--play-red)' : 'var(--play-gold)'}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-2 font-sans text-[11px]" style={{ color: 'var(--play-muted)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--play-green)' }} /> In
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--play-red)' }} /> Out
            </span>
            <span className="ml-auto">Tap a month</span>
          </div>

          {/* Bars — tap one to focus it */}
          <div className="flex items-end gap-1 h-36">
            {months.map((m, i) => {
              const nm = m.income - m.expense
              const selected = i === month
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMonth(i)}
                  className="flex-1 flex flex-col items-center gap-1 h-full focus:outline-none"
                  style={{ opacity: selected ? 1 : 0.4 }}
                  title={`${MONTH_SHORT[i]} — In ${money(m.income)}, Out ${money(m.expense)}, Net ${money(nm)}`}
                >
                  <div className="flex items-end justify-center gap-px w-full flex-1">
                    <div
                      className="w-1.5 rounded-t"
                      style={{ height: `${(m.income / maxBar) * 100}%`, background: 'var(--play-green)' }}
                    />
                    <div
                      className="w-1.5 rounded-t"
                      style={{ height: `${(m.expense / maxBar) * 100}%`, background: 'var(--play-red)' }}
                    />
                  </div>
                  <span
                    className="font-mono text-[9px]"
                    style={{ color: selected ? 'var(--play-gold)' : 'var(--play-muted)' }}
                  >
                    {MONTH_LETTERS[i]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- Selected month's expense breakdown ---- */}
      <section>
        <h2 className="font-serif text-lg mb-2" style={{ color: 'var(--play-ink)' }}>
          {MONTH_FULL[month]} {year} expenses
        </h2>
        <div className="rounded-2xl p-5" style={panel}>
          {donutTotal <= 0 ? (
            <p className="font-sans text-sm" style={{ color: 'var(--play-muted)' }}>
              No expenses logged for {MONTH_FULL[month]} {year}.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size}>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--play-border)" strokeWidth={stroke} />
                  {segments.map((s, i) => {
                    const dash = (s.amount / donutTotal) * circ
                    const el = (
                      <circle
                        key={s.name}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                        strokeWidth={stroke}
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-acc}
                        transform={`rotate(-90 ${cx} ${cy})`}
                      />
                    )
                    acc += dash
                    return el
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-lg font-semibold" style={{ color: 'var(--play-ink)' }}>
                    {money(donutTotal)}
                  </span>
                  <span className="font-sans text-[10px] uppercase tracking-wider" style={{ color: 'var(--play-muted)' }}>
                    spent
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2">
                {segments.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="font-sans text-sm truncate flex-1" style={{ color: 'var(--play-ink)' }}>
                      {s.name}
                    </span>
                    <span className="font-mono text-xs shrink-0" style={{ color: 'var(--play-muted)' }}>
                      {money(s.amount)} · {Math.round((s.amount / donutTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="font-mono text-base font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="font-sans text-[10px] uppercase tracking-wider" style={{ color: 'var(--play-muted)' }}>
        {label}
      </div>
    </div>
  )
}
