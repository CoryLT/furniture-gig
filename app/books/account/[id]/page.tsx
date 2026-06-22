import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

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
    .select('debit, credit, transaction_id, transactions(id, date, description, piece_id)')
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
      description: (t?.description as string) || 'Entry',
      pieceId: (t?.piece_id as string) || '',
      amount: isDebitNormal ? delta : -delta,
    }
  })
  const balance = isDebitNormal ? raw : -raw
  rows.sort((x, y) => (y.date || '').localeCompare(x.date || ''))

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
        {rows.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nothing in this bucket yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {rows.map((r, i) => (
              <li key={(r.id || 'x') + ':' + i}>
                {r.id ? (
                  <Link
                    href={'/books/transaction/' + r.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                  >
                    {r.pieceId &&
                      (imgByPiece[r.pieceId] ? (
                        <img
                          src={imgByPiece[r.pieceId]}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-md border border-border bg-muted" />
                      ))}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{r.description}</span>
                      <span className="block text-xs text-muted-foreground">{r.date}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-foreground">
                      {money(r.amount)}
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    {r.pieceId &&
                      (imgByPiece[r.pieceId] ? (
                        <img
                          src={imgByPiece[r.pieceId]}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-md border border-border bg-muted" />
                      ))}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{r.description}</span>
                      <span className="block text-xs text-muted-foreground">{r.date}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-foreground">
                      {money(r.amount)}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
