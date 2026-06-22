import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import YearPicker from '@/components/books/YearPicker'
import ExportCsvButton from '@/components/books/ExportCsvButton'
import { getPlan, isPro } from '@/lib/plan'
import ProLock from '@/components/billing/ProLock'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function money(n: number): string {
  const s = n < 0 ? '−$' : '$'
  return s + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Best-effort Schedule C hint (US sole-prop / single-member LLC). Suggestions only.
function schedC(name: string): string {
  const n = name.toLowerCase()
  if (/sale|revenue|income/.test(n)) return 'Sch C line 1 (gross receipts)'
  if (/advert|marketing/.test(n)) return 'Sch C line 8 (advertising)'
  if (/car|vehicle|mileage|gas|fuel/.test(n)) return 'Sch C line 9 (car & truck)'
  if (/commission|bank|merchant|fee|paypal|stripe/.test(n)) return 'Sch C line 10 (commissions & fees)'
  if (/contract|labor|crew|helper/.test(n)) return 'Sch C line 11 (contract labor)'
  if (/insur/.test(n)) return 'Sch C line 15 (insurance)'
  if (/legal|filing|professional|accounting|attorney/.test(n)) return 'Sch C line 17 (legal & professional)'
  if (/rent|lease/.test(n)) return 'Sch C line 20 (rent)'
  if (/repair|maintenance/.test(n)) return 'Sch C line 21 (repairs)'
  if (/purchase|goods|cogs|materials/.test(n)) return 'Sch C Part III (cost of goods)'
  if (/suppl/.test(n)) return 'Sch C line 22 (supplies)'
  if (/tax|license|permit/.test(n)) return 'Sch C line 23 (taxes & licenses)'
  if (/travel/.test(n)) return 'Sch C line 24a (travel)'
  if (/meal/.test(n)) return 'Sch C line 24b (meals)'
  if (/util|phone|internet/.test(n)) return 'Sch C line 25 (utilities)'
  return 'Sch C line 27a (other)'
}

export default async function TaxPage({
  searchParams,
}: {
  searchParams: { year?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const plan = await getPlan(supabase, me)
  if (!isPro(plan)) {
    return (
      <ProLock
        title="The tax-year summary"
        blurb="Pick a year and get a clean profit & loss, cost-of-goods and inventory, and a one-click export to hand your accountant. It's part of FlipWork Pro."
      />
    )
  }

  const nowYear = new Date().getFullYear()
  const year = Number(searchParams?.year) || nowYear
  const start = `${year}-01-01`
  const end = `${year}-12-31`

  // Year list for the picker: earliest transaction year .. current year.
  const { data: firstTxn } = await supabase
    .from('transactions')
    .select('date')
    .eq('owner_user_id', me)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()
  const firstYear = firstTxn?.date ? new Date((firstTxn as any).date).getFullYear() : nowYear
  const years: number[] = []
  for (let y = nowYear; y >= Math.min(firstYear, nowYear); y--) years.push(y)

  // Accounts (id -> name/type).
  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('owner_user_id', me)
  const acctById: Record<string, { name: string; type: string }> = {}
  for (const a of (accountsRaw ?? []) as any[]) acctById[a.id] = { name: a.name, type: a.type }

  // This year's transactions with their lines (drives the P&L and the CSV).
  const { data: txnsRaw } = await supabase
    .from('transactions')
    .select('id, date, description, entry_lines(debit, credit, account_id)')
    .eq('owner_user_id', me)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
  const txns = (txnsRaw ?? []) as any[]

  // P&L by category (cash basis: by transaction date).
  const incomeByAcct: Record<string, number> = {}
  const expenseByAcct: Record<string, number> = {}
  for (const t of txns) {
    for (const l of (t.entry_lines ?? []) as any[]) {
      const acc = acctById[l.account_id]
      if (!acc) continue
      const debit = Number(l.debit) || 0
      const credit = Number(l.credit) || 0
      if (acc.type === 'income') incomeByAcct[acc.name] = (incomeByAcct[acc.name] ?? 0) + (credit - debit)
      else if (acc.type === 'expense')
        expenseByAcct[acc.name] = (expenseByAcct[acc.name] ?? 0) + (debit - credit)
    }
  }
  const incomeRows = Object.entries(incomeByAcct).sort((a, b) => b[1] - a[1])
  const expenseRows = Object.entries(expenseByAcct).sort((a, b) => b[1] - a[1])
  const incomeTotal = incomeRows.reduce((s, [, v]) => s + v, 0)
  const expenseTotal = expenseRows.reduce((s, [, v]) => s + v, 0)
  const netProfit = incomeTotal - expenseTotal

  // Inventory / COGS view (matching basis).
  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('id, title, stage, acquired_at, sold_at, sale_price')
    .eq('owner_user_id', me)
  const pieces = (piecesRaw ?? []) as any[]
  const { data: costsRaw } = await supabase
    .from('piece_costs')
    .select('piece_id, total_cost')
    .eq('owner_user_id', me)
  const costByPiece: Record<string, number> = {}
  for (const c of (costsRaw ?? []) as any[]) costByPiece[c.piece_id] = Number(c.total_cost) || 0

  let cogs = 0
  let soldCount = 0
  let pieceSales = 0
  let endInventory = 0
  for (const p of pieces) {
    const soldKey = p.sold_at ? String(p.sold_at).slice(0, 10) : ''
    const acqKey = p.acquired_at ? String(p.acquired_at).slice(0, 10) : ''
    const cost = costByPiece[p.id] ?? 0
    const soldThisYear = soldKey && soldKey >= start && soldKey <= end
    if (soldThisYear) {
      cogs += cost
      soldCount += 1
      pieceSales += Number(p.sale_price) || 0
    }
    // Held at year end: acquired on/before Dec 31, not yet sold by Dec 31.
    const acquiredByEnd = !acqKey || acqKey <= end
    const notSoldByEnd = !soldKey || soldKey > end
    if (acquiredByEnd && notSoldByEnd) endInventory += cost
  }

  // CSV rows (every entry this year).
  const csvHeaders = ['Date', 'Type', 'Category', 'Description', 'Amount']
  const csvRows: (string | number)[][] = txns.map((t) => {
    const lines = (t.entry_lines ?? []) as any[]
    const incomeLine = lines.find((l) => acctById[l.account_id]?.type === 'income')
    const expenseLine = lines.find((l) => acctById[l.account_id]?.type === 'expense')
    let type = 'Transfer'
    let category = 'Between buckets'
    let amount = 0
    if (incomeLine) {
      type = 'Income'
      category = acctById[incomeLine.account_id]?.name ?? 'Income'
      amount = (Number(incomeLine.credit) || 0) - (Number(incomeLine.debit) || 0)
    } else if (expenseLine) {
      type = 'Expense'
      category = acctById[expenseLine.account_id]?.name ?? 'Expense'
      amount = -((Number(expenseLine.debit) || 0) - (Number(expenseLine.credit) || 0))
    } else {
      const dl = lines.find((l) => Number(l.debit) > 0)
      amount = dl ? Number(dl.debit) || 0 : 0
    }
    return [t.date, type, category, t.description || '', amount.toFixed(2)]
  })

  const card = 'rounded-xl border border-border p-4'
  const rowCls = 'flex items-center justify-between py-2 text-sm'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tax year</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A summary to hand your accountant — or to do your own taxes.
          </p>
        </div>
        <YearPicker year={year} years={years} />
      </div>

      {/* Bottom line */}
      <section className={`${card} mt-6`}>
        <div className={rowCls}>
          <span className="text-muted-foreground">Income (sales)</span>
          <span className="font-mono text-foreground">{money(incomeTotal)}</span>
        </div>
        <div className={rowCls}>
          <span className="text-muted-foreground">Expenses</span>
          <span className="font-mono text-foreground">{money(-expenseTotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
          <span className="font-medium text-foreground">Net profit ({year})</span>
          <span className="font-mono text-lg font-semibold text-foreground">{money(netProfit)}</span>
        </div>
      </section>

      {/* Income */}
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Income</h2>
        <div className={`${card} mt-2`}>
          {incomeRows.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No income recorded in {year}.</p>
          ) : (
            incomeRows.map(([name, val]) => (
              <div key={name} className={rowCls}>
                <span className="min-w-0">
                  <span className="block text-foreground">{name}</span>
                  <span className="block text-xs text-muted-foreground">{schedC(name)}</span>
                </span>
                <span className="ml-3 shrink-0 font-mono text-foreground">{money(val)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Expenses */}
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Expenses by category
        </h2>
        <div className={`${card} mt-2`}>
          {expenseRows.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No expenses recorded in {year}.</p>
          ) : (
            expenseRows.map(([name, val]) => (
              <div key={name} className={rowCls}>
                <span className="min-w-0">
                  <span className="block text-foreground">{name}</span>
                  <span className="block text-xs text-muted-foreground">{schedC(name)}</span>
                </span>
                <span className="ml-3 shrink-0 font-mono text-foreground">{money(val)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* COGS / inventory */}
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cost of goods sold &amp; inventory
        </h2>
        <div className={`${card} mt-2`}>
          <div className={rowCls}>
            <span className="text-muted-foreground">Pieces sold in {year}</span>
            <span className="font-mono text-foreground">{soldCount}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Sales from those pieces</span>
            <span className="font-mono text-foreground">{money(pieceSales)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Cost of those pieces (COGS)</span>
            <span className="font-mono text-foreground">{money(cogs)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Inventory still held at Dec 31</span>
            <span className="font-mono text-foreground">{money(endInventory)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Two ways to handle item costs at tax time: deduct them as you buy (already in
            &ldquo;Expenses&rdquo; above), or count them only when the item sells (COGS) and carry
            the rest as year-end inventory. Which one applies depends on your accounting method —
            ask your CPA which to use so you don&apos;t double-count.
          </p>
        </div>
      </section>

      {/* Contractors / 1099 */}
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Contractor payments (1099)
        </h2>
        <div className={`${card} mt-2`}>
          <p className="text-sm text-muted-foreground">
            Per-person payment totals and who crosses the 1099 threshold live in Payment Records,
            with their own CSV export.
          </p>
          <Link
            href="/flipper/records"
            className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent/80"
          >
            Open Payment Records →
          </Link>
        </div>
      </section>

      {/* Export */}
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Export</h2>
        <div className={`${card} mt-2 space-y-3`}>
          <p className="text-sm text-muted-foreground">
            Download every {year} entry as a spreadsheet to hand off or keep.
          </p>
          <ExportCsvButton
            filename={`flipwork-${year}-transactions.csv`}
            headers={csvHeaders}
            rows={csvRows}
            label={`Download ${year} transactions (CSV)`}
          />
        </div>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        These figures come straight from your Books. They&apos;re a starting point, not tax advice —
        please confirm everything with a qualified accountant. Schedule C line hints are suggestions
        for U.S. sole proprietors / single-member LLCs.
      </p>
    </main>
  )
}
