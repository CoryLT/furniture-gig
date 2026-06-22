import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function moveMoney(formData: FormData) {
  'use server'
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const date = String(formData.get('date') || '')
  const amount = Number(formData.get('amount'))
  const fromId = String(formData.get('from_account_id') || '')
  const toId = String(formData.get('to_account_id') || '')
  const note = String(formData.get('note') || '')

  if (!amount || amount <= 0) {
    redirect('/books/transfer/new?error=' + encodeURIComponent('Enter an amount greater than zero.'))
  }
  if (!fromId || !toId) {
    redirect('/books/transfer/new?error=' + encodeURIComponent('Pick both buckets.'))
  }
  if (fromId === toId) {
    redirect('/books/transfer/new?error=' + encodeURIComponent('Pick two different buckets.'))
  }

  const { error } = await supabase.rpc('record_transfer', {
    p_date: date || null,
    p_amount: amount,
    p_from_account_id: fromId,
    p_to_account_id: toId,
    p_note: note || null,
  })
  if (error) {
    redirect('/books/transfer/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/books?ok=transfer')
}

export default async function TransferPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: assetsRaw } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('owner_user_id', me)
    .eq('type', 'asset')
    .order('name', { ascending: true })
  const assets = (assetsRaw ?? []) as { id: string; name: string }[]

  const today = new Date().toISOString().slice(0, 10)
  const fromDefault = assets.find((a) => /cash/i.test(a.name))?.id ?? assets[0]?.id ?? ''
  const toDefault = assets.find((a) => /bank|checking/i.test(a.name))?.id ?? ''

  const labelCls = 'block text-sm font-medium text-foreground mb-1'
  const helpCls = 'mt-1 text-xs text-muted-foreground'
  const fieldCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">Move money</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record moving money between your buckets — like depositing cash into your bank. This
          just moves it; it isn&apos;t income or an expense.
        </p>
      </div>

      {searchParams?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {searchParams.error}
        </div>
      )}

      {assets.length < 2 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          You need at least two money buckets to move money between them.
        </p>
      ) : (
        <form action={moveMoney} className="mt-6 space-y-5">
          <div>
            <label className={labelCls} htmlFor="amount">Amount ($)</label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className={fieldCls}
              required
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="from_account_id">From</label>
            <select
              id="from_account_id"
              name="from_account_id"
              className={fieldCls}
              defaultValue={fromDefault}
              required
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className={helpCls}>The bucket the money is leaving (e.g. Cash on Hand).</p>
          </div>

          <div>
            <label className={labelCls} htmlFor="to_account_id">To</label>
            <select
              id="to_account_id"
              name="to_account_id"
              className={fieldCls}
              defaultValue={toDefault}
              required
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className={helpCls}>The bucket it landed in (e.g. Bank / Checking).</p>
          </div>

          <div>
            <label className={labelCls} htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={today} className={fieldCls} />
          </div>

          <div>
            <label className={labelCls} htmlFor="note">Note (optional)</label>
            <input
              id="note"
              name="note"
              type="text"
              placeholder="e.g. Deposited June cash at Relay"
              className={fieldCls}
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent/90"
          >
            Move money
          </button>
        </form>
      )}
    </main>
  )
}
