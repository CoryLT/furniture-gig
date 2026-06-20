'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Plus, CheckCircle2 } from 'lucide-react'

const money = (v: number) =>
  '$' +
  (Math.round(v * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function PastSaleForm({ me }: { me: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [paid, setPaid] = useState('')
  const [soldFor, setSoldFor] = useState('')
  const [month, setMonth] = useState('') // "YYYY-MM"
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [lastSaved, setLastSaved] = useState('')

  async function save(addAnother: boolean) {
    setErr('')
    const sp = parseFloat(soldFor)
    const paidNum = parseFloat(paid) || 0
    if (!title.trim()) {
      setErr('Give the piece a name.')
      return
    }
    if (isNaN(sp) || sp <= 0) {
      setErr('Enter what it sold for.')
      return
    }
    if (!month) {
      setErr('Pick the month it sold.')
      return
    }

    // Day doesn't matter — drop it mid-month so it sits cleanly in the period.
    const dateStr = `${month}-15`
    const soldIso = new Date(dateStr + 'T12:00:00').toISOString()
    setSaving(true)

    // 1) Create the piece, already marked sold.
    const { data, error } = await (supabase.from('inventory_pieces') as any)
      .insert({
        owner_user_id: me,
        stage: 'sold',
        title: title.trim(),
        acquired_at: dateStr,
        sold_at: soldIso,
        sale_price: sp,
      })
      .select('id')
      .single()
    if (error || !data) {
      setSaving(false)
      setErr('Could not save the piece. Try again.')
      return
    }
    const pieceId = (data as any).id

    // 2) Cost -> Books, dated to that month.
    if (paidNum > 0) {
      const { error: pe } = await supabase.rpc('set_piece_purchase', {
        p_piece_id: pieceId,
        p_amount: paidNum,
        p_date: dateStr,
      })
      if (pe) {
        setSaving(false)
        setErr('Saved the piece, but the cost didn’t reach Books. Did the SQL update get run?')
        return
      }
    }

    // 3) Sale income -> Books, dated to that month.
    const { error: se } = await supabase.rpc('record_piece_sale', {
      p_piece_id: pieceId,
      p_amount: sp,
      p_date: dateStr,
    })
    setSaving(false)
    if (se) {
      setErr('Saved the piece, but the sale didn’t reach Books. Make sure your Books accounts are set up.')
      return
    }

    setSavedCount((c) => c + 1)
    setLastSaved(`${title.trim()} — sold for ${money(sp)} (${month})`)

    if (addAnother) {
      // Keep the month so logging a run of same-month sales is fast.
      setTitle('')
      setPaid('')
      setSoldFor('')
    } else {
      router.push('/flipper/pipeline')
      router.refresh()
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {savedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          Added {savedCount} {savedCount === 1 ? 'sale' : 'sales'}
          {lastSaved ? <span className="text-muted-foreground">· last: {lastSaved}</span> : null}
        </div>
      )}

      <div className="rounded-xl border border-border p-4 space-y-3">
        <label className="block text-xs text-muted-foreground">
          What was it?
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Mid-century dresser"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            What you paid ($)
            <input
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            What it sold for ($)
            <input
              value={soldFor}
              onChange={(e) => setSoldFor(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </div>

        <label className="block text-xs text-muted-foreground">
          Month it sold <span className="text-muted-foreground/70">(day not needed)</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>

        {err && <p className="text-xs text-red-600">{err}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save & add another'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Save &amp; finish
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Each saved sale shows up in your Pipeline as a sold piece and lands in Books on the
        15th of the month you picked. You can fine-tune the exact day later by opening the
        piece in the Pipeline.
      </p>
    </div>
  )
}
