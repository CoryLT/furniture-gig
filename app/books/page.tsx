import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

// The books are live, per-operator data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// The starter "money buckets" a brand-new operator gets. Mirrors the
// chart of accounts from the FlipWork Books app so it feels familiar.
const DEFAULT_ACCOUNTS: { name: string; type: string }[] = [
  { name: 'Cash on Hand', type: 'asset' },
  { name: 'Bank / Checking', type: 'asset' },
  { name: 'Furniture Sales', type: 'income' },
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
        <h1 className="text-2xl font-semibold text-neutral-900">Books</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your double-entry bookkeeping, built right into FlipWork.
        </p>
        <div className="mt-8 rounded-xl border border-neutral-200 p-6 text-center">
          <p className="text-neutral-700">
            Let&apos;s set up your books. This creates your starter money
            buckets — cash, sales, materials, and the rest. You can rename or
            add to them later.
          </p>
          <form action={setupBooks} className="mt-5">
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600"
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
    const amount = lines.reduce((s, l) => s + Number(l.debit), 0)
    const types = lines.map((l) => l.accounts?.type)
    const isIncome = types.includes('income')
    const isExpense = types.includes('expense')
    return {
      id: t.id,
      date: t.date as string,
      description: (t.description as string) || '(no description)',
      amount,
      dir: isIncome ? 'in' : isExpense ? 'out' : 'flat',
    }
  })

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Books</h1>
          <p className="mt-1 text-sm text-neutral-500">
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
            className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 whitespace-nowrap"
          >
            Log an expense
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">Money on hand</div>
        <div className={'mt-1 text-3xl font-semibold ' + (onHand < 0 ? 'text-red-600' : 'text-neutral-900')}>
          {money(onHand)}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Recent activity</h2>
        {txns.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nothing logged yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {txns.map((t) => (
              <li key={t.id}>
                <Link href={'/books/transaction/' + t.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                  <div>
                    <div className="text-neutral-800">{t.description}</div>
                    <div className="text-xs text-neutral-400">{t.date}</div>
                  </div>
                  <div className={t.dir === 'in' ? 'font-medium text-green-700' : t.dir === 'out' ? 'font-medium text-red-600' : 'font-medium text-neutral-700'}>
                    {t.dir === 'in' ? '+' : t.dir === 'out' ? '−' : ''}{'$' + Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Your money buckets</h2>
        <div className="mt-2 space-y-5">
          {TYPE_ORDER.filter((ty) => list.some((a) => a.type === ty)).map((ty) => (
            <div key={ty}>
              <div className="text-xs text-neutral-400">{TYPE_LABELS[ty] ?? ty}</div>
              <ul className="mt-1 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {list.filter((a) => a.type === ty).map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-neutral-800">{a.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
