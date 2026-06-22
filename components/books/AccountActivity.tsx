'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteTransaction } from '@/app/books/actions'

type Row = {
  id: string
  date: string
  description: string
  amount: number
  img: string | null
}

const money = (n: number) => {
  const s = n < 0 ? '−$' : '$'
  return (
    s + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

export default function AccountActivity({ rows }: { rows: Row[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const [allRows, setAllRows] = useState<Row[]>(rows)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [delErr, setDelErr] = useState('')
  const [q, setQ] = useState('')

  // Keep in sync when the server sends a fresh list (e.g. after a refresh).
  useEffect(() => setAllRows(rows), [rows])

  async function onDelete(id: string) {
    if (!id) return
    if (!window.confirm('Delete this entry? This can’t be undone.')) return
    setDelErr('')
    setBusyId(id)
    const res = await deleteTransaction(id)
    if (res.ok) {
      setAllRows((prev) => prev.filter((r) => r.id !== id))
      router.refresh() // update the bucket balance up top
    } else {
      setDelErr(res.error || 'Could not delete. Try again.')
    }
    setBusyId(null)
  }
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const minN = min.trim() === '' ? null : Number(min)
    const maxN = max.trim() === '' ? null : Number(max)
    return allRows.filter((r) => {
      if (qq && !r.description.toLowerCase().includes(qq)) return false
      if (from && (r.date || '') < from) return false
      if (to && (r.date || '') > to) return false
      if (minN !== null && !isNaN(minN) && r.amount < minN) return false
      if (maxN !== null && !isNaN(maxN) && r.amount > maxN) return false
      return true
    })
  }, [allRows, q, from, to, min, max])

  const total = filtered.reduce((s, r) => s + r.amount, 0)
  const anyFilter = !!(q || from || to || min || max)
  const clear = () => {
    setQ('')
    setFrom('')
    setTo('')
    setMin('')
    setMax('')
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  return (
    <div className="mt-2 space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title…"
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + ' mt-1'} />
        </label>
        <label className="text-xs text-muted-foreground">
          Min $
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className={inputCls + ' mt-1'}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Max $
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className={inputCls + ' mt-1'}
          />
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} of {allRows.length} · {money(total)}
        </span>
        {anyFilter && (
          <button type="button" onClick={clear} className="font-medium text-accent hover:text-accent/80">
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {allRows.length === 0 ? 'Nothing in this bucket yet.' : 'No matches.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((r, i) => {
            const inner = (
              <>
                {r.img ? (
                  <img
                    src={r.img}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-md border border-border bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{r.description}</span>
                  <span className="block text-xs text-muted-foreground">{r.date}</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-foreground">{money(r.amount)}</span>
              </>
            )
            return (
              <li
                key={(r.id || 'x') + ':' + i}
                id={'txn-' + r.id}
                className="flex items-center scroll-mt-20"
              >
                {r.id ? (
                  <Link
                    href={
                      '/books/transaction/' +
                      r.id +
                      '?from=' +
                      encodeURIComponent(pathname + '#txn-' + r.id)
                    }
                    className="flex flex-1 items-center gap-3 px-4 py-3 hover:bg-muted"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex flex-1 items-center gap-3 px-4 py-3">{inner}</div>
                )}
                {r.id && (
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    disabled={busyId === r.id}
                    aria-label="Delete entry"
                    title="Delete entry"
                    className="px-3 py-3 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {delErr && <p className="mt-2 text-sm text-red-600">{delErr}</p>}
    </div>
  )
}
