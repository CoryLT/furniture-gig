import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// The books are live, per-operator data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// The starter "money buckets" a brand-new operator gets. Mirrors the
// chart of accounts from the FlipWork Books app so it feels familiar.
const DEFAULT_ACCOUNTS: { name: string; type: string }[] = [
  // where your money sits
  { name: 'Cash on Hand', type: 'asset' },
  { name: 'Bank / Checking', type: 'asset' },
  // money coming in
  { name: 'Furniture Sales', type: 'income' },
  // direct costs of a flip
  { name: 'Pieces Purchased', type: 'expense' },
  { name: 'Materials & Supplies', type: 'expense' },
  { name: 'Labor — Crew', type: 'expense' },
  { name: 'Transport & Gas', type: 'expense' },
  { name: 'Listing & Selling Fees', type: 'expense' },
  // overhead (carried over from Books)
  { name: 'Taxes & Licenses', type: 'expense' },
  { name: 'Filing & Legal Fees', type: 'expense' },
  { name: 'Software & Subscriptions', type: 'expense' },
  { name: 'Bank & Merchant Fees', type: 'expense' },
  { name: 'Insurance', type: 'expense' },
  { name: 'Advertising & Marketing', type: 'expense' },
  { name: 'Rent & Utilities', type: 'expense' },
  { name: 'Office & Admin', type: 'expense' },
  // owner money in / out
  { name: "Owner's Contributions", type: 'equity' },
  { name: "Owner's Draws", type: 'equity' },
]

// Server action: create the starter buckets for the logged-in operator,
// but only if they don't have any yet (safe to click twice).
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

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, is_active')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })

  const list = (accounts ?? []) as { id: string; name: string; type: string }[]

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Books</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Your double-entry bookkeeping, built right into FlipWork.
      </p>

      {list.length === 0 ? (
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
      ) : (
        <div className="mt-8 space-y-6">
          {TYPE_ORDER.filter((t) => list.some((a) => a.type === t)).map((t) => (
            <section key={t}>
              <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                {TYPE_LABELS[t] ?? t}
              </h2>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                {list
                  .filter((a) => a.type === t)
                  .map((a) => (
                    <li
                      key={a.id}
                      className="px-4 py-3 text-neutral-800"
                    >
                      {a.name}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
