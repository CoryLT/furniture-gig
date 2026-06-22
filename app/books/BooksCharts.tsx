// Charts for the Books page. Mostly presentational; the monthly bars are an
// interactive client child so they work on touch (tap a month for totals).

import MonthlyBars from './MonthlyBars'

type Month = { label: string; income: number; expense: number }
type Cat = { name: string; amount: number }

function money(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function BooksCharts({
  months,
  totalIncome,
  totalExpense,
  topCats,
}: {
  months: Month[]
  totalIncome: number
  totalExpense: number
  topCats: Cat[]
}) {
  const profit = totalIncome - totalExpense
  const maxCat = Math.max(1, ...topCats.map((c) => c.amount))

  return (
    <section className="mt-8 space-y-6">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Last 6 months
      </h2>

      {/* Summary: in / out / profit */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Money in</div>
          <div className="mt-1 text-xl font-semibold text-green-600">{money(totalIncome)}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Money out</div>
          <div className="mt-1 text-xl font-semibold text-red-600">{money(totalExpense)}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Profit</div>
          <div className={'mt-1 text-xl font-semibold ' + (profit < 0 ? 'text-red-600' : 'text-foreground')}>
            {money(profit)}
          </div>
        </div>
      </div>

      {/* Monthly in vs out bars (tap a month for its totals) */}
      <MonthlyBars months={months} />

      {/* Top expense categories */}
      {topCats.length > 0 && (
        <div className="rounded-xl border border-border p-5">
          <div className="text-xs text-muted-foreground mb-3">Where money went</div>
          <div className="space-y-3">
            {topCats.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-foreground truncate pr-2">{c.name}</span>
                  <span className="text-muted-foreground shrink-0">{money(c.amount)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-2 rounded bg-accent"
                    style={{ width: `${(c.amount / maxCat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
