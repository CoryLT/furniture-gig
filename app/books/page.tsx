import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import BooksCharts from './BooksCharts'

// The books are live, per-operator data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// The starter "money buckets" a brand-new operator gets. Mirrors the
// chart of accounts from the FlipWork Books app so it feels familiar.
const DEFAULT_ACCOUNTS: { name: string; type: string }[] = [
  { name: 'Cash on Hand', type: 'asset' },
  { name: 'Bank / Checking', type: 'asset' },
  { name: 'Sales', type: 'income' },
  { name: 'Pieces Purchased', type: 'expense' },
  { name: 'Materials & Supplies', type: 'expense' },
  { name: 'Labor — Crew', type: 'expense' },
  { name: 'Transport & Gas', type: 'expense' },
  { name: 'Listing & Selling Fees', type: 'expense' },
  { name: 'Taxes & Licenses', type: 'expense' },
  { name: 'Filing & Legal Fees', type: 'expense' },
  { name: 'Software & Subscriptions', type: 'expense' },
  { name: 'Bank & Merchant Fees', type: 'expense' },
  { name: 'Insurance', type: 'expense' },
  { name: 'Advertising & Marketing', type: 'expense' },
  { name: 'Rent & Utilities', type: 'expense' },
  { name: 'Office & Admin', type: 'expense' },
  { name: "Owner's Contributions", type: 'equity' },
  { name: "Owner's Draws", type: 'equity' },
]

async function setupBooks() {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const me = user.id
  const { count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', me)
  if ((count ?? 0) === 0) {
    await supabase
      .from('accounts')
      .insert(DEFAULT_ACCOUNTS.map((a) => ({ ...a, owner_user_id: me })))
  }
  revalidatePath('/books')
}

function money(n: number): string {
  const sign = n < 0 ? '−$' : '$'
  return sign + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'Where your money sits',
  income: 'Money coming in',
  expense: 'Where money goes',
  equity: 'Owner money',
  liability: 'Money you owe',
}
const TYPE_ORDER = ['asset', 'income', 'expense', 'equity', 'liability']

export default async function BooksPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type, is_active')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const list = (accountsRaw ?? []) as { id: string; name: string; type: string }[]

  // First-time operator: offer to create the starter buckets.
  if (list.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Books</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your double-entry bookkeeping, built right into FlipWork.
        </p>
        <div className="mt-8 rounded-xl border border-border p-6 text-center">
          <p className="text-foreground">
            Let&apos;s set up your books. This creates your starter money
            buckets — cash, sales, materials, and the rest. You can rename or
            add to them later.
          </p>
          <form action={setupBooks} className="mt-5">
            <button
              type="submit"
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent/90"
            >
              Set up my books
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Money on hand = debits minus credits across your asset buckets.
  const { data: assetLines } = await supabase
    .from('entry_lines')
    .select('debit, credit, accounts!inner(type)')
    .eq('owner_user_id', me)
    .eq('accounts.type', 'asset')
  let onHand = 0
  for (const l of (assetLines ?? []) as any[]) {
    onHand += Number(l.debit) - Number(l.credit)
  }

  // Balance for every bucket, so each one can show how much is in it.
  const { data: balLines } = await supabase
    .from('entry_lines')
    .select('account_id, debit, credit')
    .eq('owner_user_id', me)
  const rawBal: Record<string, number> = {}
  for (const l of (balLines ?? []) as any[]) {
    const id = l.account_id as string
    rawBal[id] = (rawBal[id] ?? 0) + (Number(l.debit) - Number(l.credit))
  }
  // Cash & expense buckets grow with debits; income/equity/owed grow with credits.
  const balanceOf = (a: { id: string; type: string }) => {
    const raw = rawBal[a.id] ?? 0
    return a.type === 'asset' || a.type === 'expense' ? raw : -raw
  }

  // How many imported bank lines still need sorting (for the Reconcile prompt).
  const { count: toSort } = await supabase
    .from('books_bank_feed')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', me)
    .eq('handled', false)

  // Recent activity: the latest money events, newest first.
  const { data: txnsRaw } = await supabase
    .from('transactions')
    .select('id, date, description, entry_lines(debit, credit, accounts(type))')
    .eq('owner_user_id', me)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(8)
  const txns = ((txnsRaw ?? []) as any[]).map((t) => {
    const lines = (t.entry_lines ?? []) as any[]
    // Direction by what actually happened to CASH (asset accounts):
    // money in = assets went up (green), money out = assets went down (red).
    // This treats owner's draws as money out and contributions as money in,
    // which reads more naturally than labelling by income/expense type.
    let assetDelta = 0
    for (const l of lines) {
      if (l.accounts?.type === 'asset') assetDelta += Number(l.debit) - Number(l.credit)
    }
    const totalDebits = lines.reduce((s, l) => s + Number(l.debit), 0)
    const dir = assetDelta > 0.005 ? 'in' : assetDelta < -0.005 ? 'out' : 'flat'
    const amount = Math.abs(assetDelta) > 0.005 ? Math.abs(assetDelta) : totalDebits
    return {
      id: t.id,
      date: t.date as string,
      description: (t.description as string) || '(no description)',
      amount,
      dir,
    }
  })

  // ---- Chart data: last 6 months of income vs expenses + top categories ----
  const now = new Date()
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const { data: chartRaw } = await supabase
    .from('transactions')
    .select('date, entry_lines(debit, credit, accounts(type, name))')
    .eq('owner_user_id', me)
    .gte('date', windowStart.toISOString().slice(0, 10))
  const chartTxns = (chartRaw ?? []) as any[]

  const months: { label: string; income: number; expense: number }[] = []
  const monthIndex: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthIndex[`${d.getFullYear()}-${d.getMonth()}`] = months.length
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), income: 0, expense: 0 })
  }

  const catTotals: Record<string, number> = {}
  let totalIncome = 0
  let totalExpense = 0
  for (const t of chartTxns) {
    const d = new Date(t.date)
    const idx = monthIndex[`${d.getFullYear()}-${d.getMonth()}`]
    for (const l of (t.entry_lines ?? []) as any[]) {
      const type = l.accounts?.type
      const name = l.accounts?.name || 'Other'
      const debit = Number(l.debit || 0)
      const credit = Number(l.credit || 0)
      if (type === 'income') {
        const v = credit - debit
        totalIncome += v
        if (idx !== undefined) months[idx].income += v
      } else if (type === 'expense') {
        const v = debit - credit
        totalExpense += v
        catTotals[name] = (catTotals[name] || 0) + v
        if (idx !== undefined) months[idx].expense += v
      }
    }
  }
  const topCats = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }))
  const hasChartData = totalIncome > 0 || totalExpense > 0

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your double-entry bookkeeping, built right into FlipWork.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/books/sale/new"
            className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 whitespace-nowrap"
          >
            Log a sale
          </Link>
          <Link
            href="/books/expense/new"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent/90 whitespace-nowrap"
          >
            Log an expense
          </Link>
          <Link
            href="/flipper/receipts"
            className="rounded-lg border border-accent/40 px-4 py-2 font-medium text-accent hover:bg-accent/10 whitespace-nowrap"
          >
            Snap a receipt
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Money on hand</div>
        <div className={'mt-1 text-3xl font-semibold ' + (onHand < 0 ? 'text-red-600' : 'text-foreground')}>
          {money(onHand)}
        </div>
        <Link href="/books/cash/new" className="mt-2 inline-block text-sm font-medium text-green-700 hover:text-green-800">
          + Add cash
        </Link>
      </div>

      <Link
        href="/books/inventory"
        className="mt-4 flex items-center justify-between rounded-xl border border-border px-5 py-4 hover:bg-muted"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supplies</div>
          <div className="mt-0.5 text-lg font-semibold text-foreground">Inventory &amp; reorder list</div>
        </div>
        <span className="whitespace-nowrap text-sm font-medium text-accent">Open →</span>
      </Link>

      {(toSort ?? 0) > 0 && (
        <Link
          href="/books/reconcile"
          className="mt-4 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-5 py-4 hover:bg-accent/20"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-accent">Catch up your books</div>
            <div className="mt-0.5 text-lg font-semibold text-foreground">{toSort} bank lines to sort</div>
          </div>
          <span className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground">Reconcile →</span>
        </Link>
      )}

      {hasChartData && (
        <BooksCharts
          months={months}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          topCats={topCats}
        />
      )}

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent activity</h2>
        {txns.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {txns.map((t) => (
              <li key={t.id}>
                <Link href={'/books/transaction/' + t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted">
                  <div>
                    <div className="text-foreground">{t.description}</div>
                    <div className="text-xs text-muted-foreground">{t.date}</div>
                  </div>
                  <div className={t.dir === 'in' ? 'font-medium text-green-700' : t.dir === 'out' ? 'font-medium text-red-600' : 'font-medium text-foreground'}>
                    {t.dir === 'in' ? '+' : t.dir === 'out' ? '−' : ''}{'$' + Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your money buckets</h2>
        <div className="mt-2 space-y-5">
          {TYPE_ORDER.filter((ty) => list.some((a) => a.type === ty)).map((ty) => (
            <div key={ty}>
              <div className="text-xs text-muted-foreground">{TYPE_LABELS[ty] ?? ty}</div>
              <ul className="mt-1 divide-y divide-border rounded-xl border border-border">
                {list.filter((a) => a.type === ty).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={'/books/account/' + a.id}
                      className="flex items-center justify-between px-4 py-2.5 text-foreground hover:bg-muted"
                    >
                      <span className="truncate">{a.name}</span>
                      <span className="ml-3 shrink-0 font-mono text-sm text-muted-foreground">
                        {money(balanceOf(a))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
