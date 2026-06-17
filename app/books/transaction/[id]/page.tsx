import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TYPE_LABELS: Record<string, string> = {
  asset: 'Where your money sits',
  income: 'Money coming in',
  expense: 'Where money goes',
  equity: 'Owner money',
  liability: 'Money you owe',
}
const TYPE_ORDER = ['asset', 'income', 'expense', 'equity', 'liability']

// Edit the whole entry (amount + accounts too) via the balance-safe helper.
async function updateTxn(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const id = String(formData.get('id') || '')
  const date = String(formData.get('date') || '')
  const amount = Number(formData.get('amount'))
  const debitAccountId = String(formData.get('debit_account_id') || '')
  const creditAccountId = String(formData.get('credit_account_id') || '')
  const description = String(formData.get('description') || '')
  const memo = String(formData.get('memo') || '') || null
  const pieceId = String(formData.get('piece_id') || '') || null
  const contactId = String(formData.get('contact_id') || '') || null

  if (!amount || amount <= 0) {
    redirect('/books/transaction/' + id + '?error=' + encodeURIComponent('Enter an amount greater than zero.'))
  }
  if (!debitAccountId || !creditAccountId) {
    redirect('/books/transaction/' + id + '?error=' + encodeURIComponent('Both accounts are required.'))
  }

  const { error } = await supabase.rpc('update_entry', {
    p_id: id,
    p_date: date,
    p_amount: amount,
    p_debit_account_id: debitAccountId,
    p_credit_account_id: creditAccountId,
    p_description: description,
    p_memo: memo,
    p_piece_id: pieceId,
    p_contact_id: contactId,
  })

  if (error) {
    redirect('/books/transaction/' + id + '?error=' + encodeURIComponent(error.message))
  }
  redirect('/books/transaction/' + id + '?ok=1')
}

// Delete the whole entry: both balanced lines, then the header.
async function deleteTxn(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id
  const id = String(formData.get('id') || '')
  await supabase.from('entry_lines').delete().eq('transaction_id', id).eq('owner_user_id', me)
  await supabase.from('transactions').delete().eq('id', id).eq('owner_user_id', me)
  redirect('/books')
}

export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { ok?: string; error?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: txn } = await supabase
    .from('transactions')
    .select('id, date, description, memo, piece_id, contact_id, entry_lines(debit, credit, account_id)')
    .eq('id', params.id)
    .eq('owner_user_id', me)
    .single()

  if (!txn) redirect('/books')
  const t = txn as any
  const lines = (t.entry_lines ?? []) as any[]
  const amount = lines.reduce((s, l) => s + Number(l.debit), 0)
  const debitLine = lines.find((l) => Number(l.debit) > 0)
  const creditLine = lines.find((l) => Number(l.credit) > 0)
  const debitAccountId = debitLine ? debitLine.account_id : ''
  const creditAccountId = creditLine ? creditLine.account_id : ''

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const accounts = (accountsRaw ?? []) as { id: string; name: string; type: string }[]

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

  const labelCls = 'block text-sm font-medium text-neutral-700 mb-1'
  const helpCls = 'mt-1 text-xs text-neutral-400'
  const fieldCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400'

  const accountOptions = TYPE_ORDER.filter((ty) => accounts.some((a) => a.type === ty)).map((ty) => (
    <optgroup key={ty} label={TYPE_LABELS[ty] ?? ty}>
      {accounts.filter((a) => a.type === ty).map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </optgroup>
  ))

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Edit entry</h1>
        <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to Books
        </Link>
      </div>

      {searchParams?.ok && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          Saved ✓
        </div>
      )}
      {searchParams?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={updateTxn} className="mt-6 space-y-5">
        <input type="hidden" name="id" value={t.id} />

        <div>
          <label className={labelCls} htmlFor="amount">Amount ($)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={amount} className={fieldCls} required />
        </div>

        <div>
          <label className={labelCls} htmlFor="debit_account_id">Category / where it landed</label>
          <select id="debit_account_id" name="debit_account_id" className={fieldCls} defaultValue={debitAccountId} required>
            {accountOptions}
          </select>
          <p className={helpCls}>The cost bucket for an expense, or the account money landed in for a sale.</p>
        </div>

        <div>
          <label className={labelCls} htmlFor="credit_account_id">Paid from / income source</label>
          <select id="credit_account_id" name="credit_account_id" className={fieldCls} defaultValue={creditAccountId} required>
            {accountOptions}
          </select>
          <p className={helpCls}>The account you paid from for an expense, or the income earned for a sale.</p>
        </div>

        <div>
          <label className={labelCls} htmlFor="date">Date</label>
          <input id="date" name="date" type="date" defaultValue={t.date} className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="description">Description</label>
          <input id="description" name="description" type="text" defaultValue={t.description || ''} className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="memo">Note (optional)</label>
          <input id="memo" name="memo" type="text" defaultValue={t.memo || ''} className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="piece_id">Tagged piece (optional)</label>
          <select id="piece_id" name="piece_id" className={fieldCls} defaultValue={t.piece_id || ''}>
            <option value="">— none —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>{p.title || 'Untitled piece'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="contact_id">Person (optional)</label>
          <select id="contact_id" name="contact_id" className={fieldCls} defaultValue={t.contact_id || ''}>
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
          Save changes
        </button>
      </form>

      <form action={deleteTxn} className="mt-8 border-t border-neutral-200 pt-6">
        <input type="hidden" name="id" value={t.id} />
        <button
          type="submit"
          className="rounded-lg border border-red-300 px-5 py-2.5 font-medium text-red-700 hover:bg-red-50"
        >
          Delete this entry
        </button>
      </form>
    </main>
  )
}
