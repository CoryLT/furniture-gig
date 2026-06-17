import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// Live, per-operator data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

function money(n: number): string {
  const sign = n < 0 ? '−$' : '$'
  return sign + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Tidy a raw bank description into something readable for the Description box.
function cleanDesc(raw: string | null): string {
  if (!raw) return ''
  return raw.replace(/\s+/g, ' ').trim()
}

// ----------------------------------------------------------------
// Server action: sort ONE bank line.
//   - "save": write a balanced ledger entry, link the line, mark handled
//   - "skip": just mark the line handled (personal / not business)
// We re-read the line from the database by id so the amount and date are
// authoritative (never trust numbers posted from the page).
// ----------------------------------------------------------------
async function reconcileLine(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const lineId = String(formData.get('line_id') || '')
  const action = String(formData.get('action') || 'save')
  const accountId = String(formData.get('account_id') || '') || null
  const bankAccountId = String(formData.get('bank_account_id') || '') || null
  const description = String(formData.get('description') || '')
  const pieceId = String(formData.get('piece_id') || '') || null
  const contactId = String(formData.get('contact_id') || '') || null

  if (!lineId) redirect('/books/reconcile')

  // Authoritative line (RLS already limits this to the owner's own rows).
  const { data: line } = await supabase
    .from('books_bank_feed')
    .select('id, amount, posted_date')
    .eq('id', lineId)
    .eq('owner_user_id', me)
    .single()
  if (!line) redirect('/books/reconcile')

  // "Skip for now": leave it unsorted but send it to the back of the line,
  // so it comes back after the fresh ones. "Not business": done for good.
  if (action === 'skip') {
    await supabase
      .from('books_bank_feed')
      .update({ status: 'skipped' })
      .eq('id', lineId)
      .eq('owner_user_id', me)
    redirect('/books/reconcile')
  }
  if (action === 'dismiss') {
    await supabase
      .from('books_bank_feed')
      .update({ handled: true })
      .eq('id', lineId)
      .eq('owner_user_id', me)
    redirect('/books/reconcile')
  }

  const amount = Math.abs(Number(line.amount))
  const date = line.posted_date as string
  const isMoneyIn = Number(line.amount) > 0

  if (!accountId) {
    redirect('/books/reconcile?error=' + encodeURIComponent('Pick what this was first.'))
  }
  if (!bankAccountId) {
    redirect('/books/reconcile?error=' + encodeURIComponent('Pick which account it went through.'))
  }
  if (!amount || amount <= 0) {
    redirect('/books/reconcile?error=' + encodeURIComponent('This line has no amount to sort.'))
  }

  let newTxnId: string | null = null

  if (isMoneyIn) {
    // money IN -> debit the bank (asset), credit income/equity
    const { data, error } = await supabase.rpc('record_cash_sale', {
      p_date: date,
      p_amount: amount,
      p_asset_account_id: bankAccountId,
      p_income_account_id: accountId,
      p_description: description,
      p_memo: null,
      p_piece_id: pieceId,
      p_contact_id: contactId,
    })
    if (error) redirect('/books/reconcile?error=' + encodeURIComponent(error.message))
    newTxnId = data as unknown as string
  } else {
    // money OUT -> debit expense/equity, credit the bank (asset)
    const { data, error } = await supabase.rpc('record_expense', {
      p_date: date,
      p_amount: amount,
      p_expense_account_id: accountId,
      p_paid_from_account_id: bankAccountId,
      p_description: description,
      p_memo: null,
      p_piece_id: pieceId,
      p_contact_id: contactId,
    })
    if (error) redirect('/books/reconcile?error=' + encodeURIComponent(error.message))
    newTxnId = data as unknown as string
  }

  // Link the bank line to the entry we just made + mark it handled.
  await supabase
    .from('books_bank_feed')
    .update({ handled: true, transaction_id: newTxnId })
    .eq('id', lineId)
    .eq('owner_user_id', me)

  redirect('/books/reconcile')
}

export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  // How many still need sorting, and the oldest one to work on now.
  const { count: leftCount } = await supabase
    .from('books_bank_feed')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', me)
    .eq('handled', false)

  const { data: lineRaw } = await supabase
    .from('books_bank_feed')
    .select('id, amount, posted_date, raw_description')
    .eq('owner_user_id', me)
    .eq('handled', false)
    .order('status', { ascending: true })
    .order('posted_date', { ascending: true })
    .order('imported_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const line = lineRaw as
    | { id: string; amount: number; posted_date: string; raw_description: string | null }
    | null

  // All caught up.
  if (!line) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Reconcile</h1>
          <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-800">← Back to Books</Link>
        </div>
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <div className="text-3xl">🎉</div>
          <p className="mt-2 font-medium text-green-800">All caught up!</p>
          <p className="mt-1 text-sm text-green-700">
            Every bank line has been sorted into your books.
          </p>
          <Link
            href="/books"
            className="mt-5 inline-block rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600"
          >
            Back to Books
          </Link>
        </div>
      </main>
    )
  }

  const isMoneyIn = Number(line.amount) > 0

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('owner_user_id', me)
    .order('name', { ascending: true })
  const accounts = (accountsRaw ?? []) as { id: string; name: string; type: string }[]
  const expenseAccounts = accounts.filter((a) => a.type === 'expense')
  const incomeAccounts = accounts.filter((a) => a.type === 'income')
  const equityAccounts = accounts.filter((a) => a.type === 'equity')
  const assetAccounts = accounts.filter((a) => a.type === 'asset')

  // Default "which account" to Bank / Checking if it exists.
  const defaultBank =
    assetAccounts.find((a) => /bank|checking/i.test(a.name))?.id ?? assetAccounts[0]?.id ?? ''

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
        <h1 className="text-2xl font-semibold text-neutral-900">Reconcile</h1>
        <Link href="/books" className="text-sm text-neutral-500 hover:text-neutral-800">← Back to Books</Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Sort each bank line into your books. <span className="font-medium text-neutral-700">{leftCount ?? 0} left.</span>
      </p>

      {searchParams?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {searchParams.error}
        </div>
      )}

      {/* The bank line being sorted */}
      <div className="mt-6 rounded-xl border border-neutral-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {isMoneyIn ? 'Money in' : 'Money out'}
            </div>
            <div className="mt-1 text-xs text-neutral-400">{line.posted_date}</div>
          </div>
          <div className={'text-2xl font-semibold ' + (isMoneyIn ? 'text-green-700' : 'text-red-600')}>
            {isMoneyIn ? '+' : '−'}{'$' + Math.abs(Number(line.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <p className="mt-3 break-words text-sm text-neutral-600">{cleanDesc(line.raw_description)}</p>
      </div>

      <form action={reconcileLine} className="mt-6 space-y-5">
        <input type="hidden" name="line_id" value={line.id} />

        <div>
          <label className={labelCls} htmlFor="account_id">
            {isMoneyIn ? 'What was this money?' : 'What did this pay for?'}
          </label>
          <select id="account_id" name="account_id" className={fieldCls} defaultValue="">
            <option value="">Choose…</option>
            {isMoneyIn ? (
              <>
                <optgroup label="Money you made">
                  {incomeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Owner money">
                  {equityAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
              </>
            ) : (
              <>
                <optgroup label="Expense categories">
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Owner money">
                  {equityAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="bank_account_id">
            {isMoneyIn ? 'Deposited into' : 'Paid from'}
          </label>
          <select id="bank_account_id" name="bank_account_id" className={fieldCls} defaultValue={defaultBank}>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="description">Description</label>
          <input
            id="description"
            name="description"
            type="text"
            defaultValue={cleanDesc(line.raw_description)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="piece_id">Tag to a piece (optional)</label>
          <select id="piece_id" name="piece_id" className={fieldCls} defaultValue="">
            <option value="">— none —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>{p.title || 'Untitled piece'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="contact_id">
            {isMoneyIn ? 'From (customer, optional)' : 'Paid to (optional)'}
          </label>
          <select id="contact_id" name="contact_id" className={fieldCls} defaultValue="">
            <option value="">— none —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            name="action"
            value="save"
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600"
          >
            Save &amp; next
          </button>
          <button
            type="submit"
            name="action"
            value="skip"
            className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Skip for now
          </button>
          <button
            type="submit"
            name="action"
            value="dismiss"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-400 hover:text-neutral-600"
          >
            Not business
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          <span className="font-medium">Skip for now</span> sends it to the back to revisit later.{' '}
          <span className="font-medium">Not business</span> removes it for good.
        </p>
      </form>
    </main>
  )
}
