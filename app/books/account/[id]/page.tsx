import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AccountActivity from '@/components/books/AccountActivity'

// Live data — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

function money(n: number): string {
  const sign = n < 0 ? '−$' : '$'
  return (
    sign +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'Where your money sits',
  income: 'Money coming in',
  expense: 'Where money goes',
  equity: 'Owner money',
  liability: 'Money you owe',
}

export default async function AccountPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  const { data: acct } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('id', params.id)
    .eq('owner_user_id', me)
    .single()
  if (!acct) notFound()
  const a = acct as { id: string; name: string; type: string }

  const { data: lines } = await supabase
    .from('entry_lines')
    .select('debit, credit, transaction_id, transactions(id, date, description, piece_id, created_at)')
    .eq('owner_user_id', me)
    .eq('account_id', params.id)

  const isDebitNormal = a.type === 'asset' || a.type === 'expense'
  let raw = 0
  const rows = ((lines ?? []) as any[]).map((l) => {
    const delta = Number(l.debit) - Number(l.credit) // debit-positive
    raw += delta
    const t = l.transactions
    return {
      id: (t?.id as string) || '',
      date: (t?.date as string) || '',
      created: (t?.created_at as string) || '',
      description: (t?.description as string) || 'Entry',
      pieceId: (t?.piece_id as string) || '',
      amount: isDebitNormal ? delta : -delta,
    }
  })
  const balance = isDebitNormal ? raw : -raw
  // Newest day first; within the same day, keep the order they were entered
  // (so a batch of same-date sales reads 1, 2, 3… instead of jumbled).
  rows.sort((x, y) => {
    const byDate = (y.date || '').localeCompare(x.date || '')
    if (byDate !== 0) return byDate
    return (x.created || '').localeCompare(y.created || '')
  })

  // Pull a photo for any row tied to a piece (so sales show the item).
  const pieceIds = Array.from(new Set(rows.map((r) => r.pieceId).filter(Boolean)))
  const imgByPiece: Record<string, string> = {}
  if (pieceIds.length > 0) {
    const { data: pcs } = await supabase
      .from('inventory_pieces')
      .select('id, image_path')
      .in('id', pieceIds)
    for (const p of (pcs ?? []) as any[]) {
      if (p.image_path) {
        const { data } = supabase.storage.from('marketplace-photos').getPublicUrl(p.image_path)
        if (data?.publicUrl) imgByPiece[p.id] = data.publicUrl
      }
    }
  }

  // Rows for the client-side filter/search bar.
  const clientRows = rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    img: r.pieceId ? imgByPiece[r.pieceId] ?? null : null,
  }))

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Books
      </Link>

      <div className="mt-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {TYPE_LABELS[a.type] ?? a.type}
        </div>
        <h1 className="text-2xl font-semibold text-foreground">{a.name}</h1>
        <p className="mt-1 font-mono text-lg text-foreground">{money(balance)}</p>
      </div>

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Activity
        </h2>
        <AccountActivity rows={clientRows} />
      </section>
    </main>
  )
}
