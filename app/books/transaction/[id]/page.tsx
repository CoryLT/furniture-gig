import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Update the safe header fields (no money change, so the books stay balanced).
async function updateTxn(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const id = String(formData.get('id') || '')
  const date = String(formData.get('date') || '')
  const description = String(formData.get('description') || '')
  const memo = String(formData.get('memo') || '') || null
  const pieceId = String(formData.get('piece_id') || '') || null
  const contactId = String(formData.get('contact_id') || '') || null

  const { error } = await supabase
    .from('transactions')
    .update({ date, description, memo, piece_id: pieceId, contact_id: contactId })
    .eq('id', id)
    .eq('owner_user_id', me)

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

  // remove both lines in one statement (stays balanced), then the header
  await supabase.from('entry_lines').delete().eq('transaction_id', id).eq('owner_user_id', me)
  await supabase.from('transactions').delete().eq('id', id).eq('owner_user_id', me)

  redirect('/books')
}

function money(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
    .select('id, date, description, memo, piece_id, contact_id, entry_lines(debit, credit, accounts(name, type))')
    .eq('id', params.id)
    .eq('owner_user_id', me)
    .single()

  if (!txn) redirect('/books')
  const t = txn as any

  const lines = (t.entry_lines ?? []) as any[]
  const amount = lines.reduce((s, l) => s + Number(l.debit), 0)

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
  const fieldCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400'

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

      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">Amount</div>
        <div className="text-2xl font-semibold text-neutral-900">{money(amount)}</div>
        <ul className="mt-3 space-y-1 text-sm text-neutral-600">
          {lines.map((l, i) => (
            <li key={i}>
              {l.accounts?.name}
              {' — '}
              {Number(l.debit) > 0 ? 'money in/cost ' + money(Number(l.debit)) : 'money out ' + money(Number(l.credit))}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-400">
          To change the amount or accounts, delete this entry and re-log it. Full
          amount editing is coming next.
        </p>
      </div>

      <form action={updateTxn} className="mt-6 space-y-5">
        <input type="hidden" name="id" value={t.id} />

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
