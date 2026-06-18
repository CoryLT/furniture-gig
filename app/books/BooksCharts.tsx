// Presentational, dependency-free charts for the Books page.
// Pure server component (no interactivity) — just themed divs/SVG.

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
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)))
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

      {/* Monthly in vs out bars */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> In
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Out
          </span>
        </div>
        <div className="flex items-end gap-3 h-36">
          {months.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="flex items-end justify-center gap-1 w-full flex-1">
                <div
                  className="w-3 rounded-t bg-green-500"
                  style={{ height: `${(m.income / maxBar) * 100}%` }}
                  title={`In: ${money(m.income)}`}
                />
                <div
                  className="w-3 rounded-t bg-red-400"
                  style={{ height: `${(m.expense / maxBar) * 100}%` }}
                  title={`Out: ${money(m.expense)}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

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
