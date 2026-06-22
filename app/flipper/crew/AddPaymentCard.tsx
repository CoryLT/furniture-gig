'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

export default function AddPaymentCard({
  crewMemberId,
  personName,
  pieces,
}: {
  crewMemberId: string
  personName: string
  pieces: { id: string; title: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [pieceId, setPieceId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function add() {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setErr('Enter an amount greater than zero.')
      return
    }
    setErr('')
    setBusy(true)
    const { error } = await supabase.rpc('add_labor_payment', {
      p_amount: amt,
      p_crew_member_id: crewMemberId,
      p_date: date || null,
      p_note: note.trim(),
      p_piece_id: pieceId || null,
    })
    setBusy(false)
    if (error) {
      setErr('Could not add the payment. Did the SQL update get run? Try again.')
      return
    }
    setAmount('')
    setNote('')
    setPieceId('')
    setDate(today)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="w-4 h-4" />
        Add a payment
      </button>
    )
  }

  const fieldCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  return (
    <div className="card card-body space-y-3">
      <p className="text-sm font-medium text-foreground">Add a payment to {personName}</p>
      <div className="grid grid-cols-2 gap-3">
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
        For which piece? <span className="text-muted-foreground/70">(optional)</span>
        <select value={pieceId} onChange={(e) => setPieceId(e.target.value)} className={fieldCls}>
          <option value="">— not tied to a piece —</option>
          {pieces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || 'Untitled piece'}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        Note <span className="text-muted-foreground/70">(optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. sanding & painting"
          className={fieldCls}
        />
      </label>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !amount}
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add payment'}
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
  )
}
