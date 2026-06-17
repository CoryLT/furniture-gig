import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Records money you put into the business: adds to an asset account and
// books it against "Owner's Contributions" (equity) — a balanced money-in.
async function addCash(formData: FormData) {
  'use server'
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const date = String(formData.get('date') || '')
  const amount = Number(formData.get('amount'))
  const landsInId = String(formData.get('lands_in_id') || '')
  const note = String(formData.get('note') || '') || 'Starting cash'

  if (!amount || amount <= 0) {
    redirect('/books/cash/new?error=' + encodeURIComponent('Enter an amount greater than zero.'))
  }
  if (!landsInId) {
    redirect('/books/cash/new?error=' + encodeURIComponent('Pick where the cash lands.'))
  }

  // find the owner's-contributions equity bucket
  const { data: equityRows } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('owner_user_id', me)
    .eq('type', 'equity')
  const equity = (equityRows ?? []) as { id: string; name: string }[]
  const contrib =
    equity.find((a) => a.name.toLowerCase().includes('contribution')) || equity[0]

  if (!contrib) {
    redirect('/books/cash/new?error=' + encodeURIComponent('No "Owner\'s Contributions" bucket found.'))
  }

  const { error } = await supabase.rpc('record_cash_sale', {
    p_date: date,
    p_amount: amount,
    p_asset_account_id: landsInId,
    p_income_account_id: contrib.id,
    p_description: note,
    p_memo: null,
    p_piece_id: null,
    p_contact_id: null,
  })

  if (error) {
    redirect('/books/cash/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/books?ok=cash')
}

export default async function AddCashPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: assetsRaw } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('owner_user_id', me)
    .eq('type', 'asset')
    .order('name', { ascending: true })
  const assets = (assetsRaw ?? []) as { id: string; name: string }[]
  const defaultAsset =
    assets.find((a) => a.name.toLowerCase().includes('cash'))?.id || assets[0]?.id || ''

  const today = new Date().toISOString().slice(0, 10)
  const labelCls = 'block text-sm font-medium text-foreground mb-1'
  const fieldCls =
    'w-full rounded-lg border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Add cash</h1>
        <Link href="/books" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Books
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Money you&apos;re putting into the business from your own pocket. This is
        how your cash on hand starts from an honest number.
      </p>

      {searchParams?.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={addCash} className="mt-6 space-y-5">
        <div>
          <label className={labelCls} htmlFor="amount">Amount ($)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={fieldCls} required />
        </div>

        <div>
          <label className={labelCls} htmlFor="lands_in_id">Lands in</label>
          <select id="lands_in_id" name="lands_in_id" className={fieldCls} defaultValue={defaultAsset} required>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="date">Date</label>
          <input id="date" name="date" type="date" defaultValue={today} className={fieldCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="note">Note (optional)</label>
          <input id="note" name="note" type="text" placeholder="Starting cash" className={fieldCls} />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white hover:bg-green-700"
        >
          Add cash
        </button>
      </form>
    </main>
  )
}
