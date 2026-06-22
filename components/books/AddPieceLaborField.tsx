'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

export default function AddPieceLaborField({
  pieceId,
  crew,
}: {
  pieceId: string
  crew: { id: string; label: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [who, setWho] = useState('')
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const fieldCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  async function add() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setErr('Enter an amount greater than zero.')
      return
    }
    if (!who) {
      setErr('Pick who you paid.')
      return
    }
    setErr('')
    setBusy(true)
    const { error } = await supabase.rpc('add_labor_payment', {
      p_amount: amt,
      p_crew_member_id: who,
      p_date: date || null,
      p_note: 'Labor',
      p_piece_id: pieceId,
    })
    setBusy(false)
    if (error) {
      setErr('Could not add the labor. Did the SQL update get run? Try again.')
      return
    }
    setAmount('')
    setWho('')
    setDate(today)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Plus className="w-4 h-4" />
          Add labor paid on this piece
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Labor paid on this piece</p>
          <p className="text-xs text-muted-foreground">
            Money you paid someone to work on this piece. This adds a new entry — it doesn&apos;t
            change the sale above.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              Amount ($)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className={fieldCls}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            Who you paid
            <select value={who} onChange={(e) => setWho(e.target.value)} className={fieldCls}>
              <option value="">Choose a person…</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {crew.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No crew yet — add someone from My Crew first, then come back.
            </p>
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !amount || !who}
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? 'Adding…' : 'Add labor'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setErr('')
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
