import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AddableSelect from '@/components/books/AddableSelect'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server action: log one sale as a balanced double-entry transaction
// by calling the record_cash_sale function in the database.
async function logSale(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const date = String(formData.get('date') || '')
  const amount = Number(formData.get('amount'))
  const assetAccountId = String(formData.get('asset_account_id') || '')
  const incomeAccountId = String(formData.get('income_account_id') || '')
  const description = String(formData.get('description') || '')
  const memo = String(formData.get('memo') || '') || null
  let pieceId = String(formData.get('piece_id') || '') || null
  let contactId = String(formData.get('contact_id') || '') || null

  // "+ Add a new piece…" chosen: create it now and use the new id.
  if (pieceId === '__new__') {
    const title = String(formData.get('new_piece_title') || '').trim()
    pieceId = null
    if (title) {
      const { data: np } = await supabase
        .from('inventory_pieces')
        .insert({ owner_user_id: user.id, title })
        .select('id')
        .single()
      pieceId = np?.id ?? null
    }
  }
  // "+ Add someone new…" chosen: create the contact now.
  if (contactId === '__new__') {
    const cname = String(formData.get('new_contact_name') || '').trim()
    contactId = null
    if (cname) {
      const { data: nc } = await supabase
        .from('contacts')
        .insert({ owner_user_id: user.id, name: cname, type: 'other' })
        .select('id')
        .single()
      contactId = nc?.id ?? null
    }
  }

  if (!amount || amount <= 0) {
    redirect('/books/sale/new?error=' + encodeURIComponent('Enter an amount greater than zero.'))
  }
  if (!assetAccountId || !incomeAccountId) {
    redirect('/books/sale/new?error=' + encodeURIComponent('Pick where the money landed and an income type.'))
  }

  const { error } = await supabase.rpc('record_cash_sale', {
    p_date: date,
    p_amount: amount,
    p_asset_account_id: assetAccountId,
    p_income_account_id: incomeAccountId,
    p_description: description,
    p_memo: memo,
    p_piece_id: pieceId,
    p_contact_id: contactId,
  })

  if (error) {
    redirect('/books/sale/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/books/sale/new?ok=1')
}

export default async function NewSalePage({
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
  const assetAccounts = accounts.filter((a) => a.type === 'asset')
  const incomeAccounts = accounts.filter((a) => a.type === 'income')

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
        <h1 className="text-2xl font-semibold text-neutral-900">Log a sale</h1>
        <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to Books
        </Link>
      </div>

      {searchParams?.ok && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          Saved ✓ — sale logged to your books.
        </div>
      )}
      {searchParams?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={logSale} className="mt-6 space-y-5">
        <div>
          <label className={labelCls} htmlFor="date">Date</label>
          <input id="date" name="date" type="date" defaultValue={today} className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="amount">Amount ($)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={fieldCls} required />
        </div>

        <div>
          <label className={labelCls} htmlFor="asset_account_id">Money landed in</label>
          <select id="asset_account_id" name="asset_account_id" className={fieldCls} required>
            <option value="">Choose an account…</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="income_account_id">Income type</label>
          <select id="income_account_id" name="income_account_id" className={fieldCls} required>
            <option value="">Choose…</option>
            {incomeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="description">Description</label>
          <input id="description" name="description" type="text" placeholder="e.g. Oak dresser sold" className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="piece_id">Which piece sold? (optional)</label>
          <AddableSelect
            name="piece_id"
            newName="new_piece_title"
            options={pieces.map((p) => ({ id: p.id, label: p.title || 'Untitled piece' }))}
            addLabel="+ Add a new piece…"
            placeholder="New piece name"
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="contact_id">Sold to (optional)</label>
          <AddableSelect
            name="contact_id"
            newName="new_contact_name"
            options={contacts.map((c) => ({ id: c.id, label: c.name }))}
            addLabel="+ Add someone new…"
            placeholder="New customer name"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700"
        >
          Log sale
        </button>
      </form>
    </main>
  )
}
