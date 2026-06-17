import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server action: log one expense as a balanced double-entry transaction
// by calling the record_expense function in the database.
async function logExpense(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const date = String(formData.get('date') || '')
  const amount = Number(formData.get('amount'))
  const expenseAccountId = String(formData.get('expense_account_id') || '')
  const paidFromAccountId = String(formData.get('paid_from_account_id') || '')
  const description = String(formData.get('description') || '')
  const memo = String(formData.get('memo') || '') || null
  const pieceId = String(formData.get('piece_id') || '') || null
  const contactId = String(formData.get('contact_id') || '') || null

  if (!amount || amount <= 0) {
    redirect('/books/expense/new?error=' + encodeURIComponent('Enter an amount greater than zero.'))
  }
  if (!expenseAccountId || !paidFromAccountId) {
    redirect('/books/expense/new?error=' + encodeURIComponent('Pick a category and a "paid from" account.'))
  }

  const { error } = await supabase.rpc('record_expense', {
    p_date: date,
    p_amount: amount,
    p_expense_account_id: expenseAccountId,
    p_paid_from_account_id: paidFromAccountId,
    p_description: description,
    p_memo: memo,
    p_piece_id: pieceId,
    p_contact_id: contactId,
  })

  if (error) {
    redirect('/books/expense/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/books/expense/new?ok=1')
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const accounts = (accountsRaw ?? []) as { id: string; name: string; type: string }[]
  const expenseAccounts = accounts.filter((a) => a.type === 'expense')
  const assetAccounts = accounts.filter((a) => a.type === 'asset')

  const { data: piecesRaw } = await supabase
    .from('inventory_pieces')
    .select('id, title')
    .eq('owner_user_id', me)
    .order('created_at', { ascending: false })
  const pieces = (piecesRaw ?? []) as { id: string; title: string }[]

  const { data: contactsRaw } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const contacts = (contactsRaw ?? []) as { id: string; name: string }[]

  const today = new Date().toISOString().slice(0, 10)
  const labelCls = 'block text-sm font-medium text-neutral-700 mb-1'
  const fieldCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Log an expense</h1>
        <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to Books
        </Link>
      </div>

      {searchParams?.ok && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          Saved ✓ — logged to your books.
        </div>
      )}
      {searchParams?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={logExpense} className="mt-6 space-y-5">
        <div>
          <label className={labelCls} htmlFor="date">Date</label>
          <input id="date" name="date" type="date" defaultValue={today} className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="amount">Amount ($)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={fieldCls} required />
        </div>

        <div>
          <label className={labelCls} htmlFor="expense_account_id">Category (what you spent on)</label>
          <select id="expense_account_id" name="expense_account_id" className={fieldCls} required>
            <option value="">Choose a category…</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="paid_from_account_id">Paid from</label>
          <select id="paid_from_account_id" name="paid_from_account_id" className={fieldCls} required>
            <option value="">Choose an account…</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="description">Description</label>
          <input id="description" name="description" type="text" placeholder="e.g. Sandpaper and paint" className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="piece_id">Tag to a piece (optional)</label>
          <select id="piece_id" name="piece_id" className={fieldCls}>
            <option value="">— none —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>{p.title || 'Untitled piece'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="contact_id">Paid to (optional)</label>
          <select id="contact_id" name="contact_id" className={fieldCls}>
            <option value="">— none —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600"
        >
          Log expense
        </button>
      </form>
    </main>
  )
}
