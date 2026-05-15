'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency, payoutStatusClass, payoutStatusLabel } from '@/lib/utils'
import type { PayoutStatus } from '@/types/database'

interface Props {
  payout: any
}

export default function PayoutRow({ payout }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const worker = payout.worker_profiles
  const gig = payout.gigs

  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<PayoutStatus>(payout.payout_status)
  const [reference, setReference] = useState(payout.payout_reference ?? '')
  const [payoutDate, setPayoutDate] = useState(payout.payout_date ?? '')
  const [notes, setNotes] = useState(payout.notes ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)

    await supabase
      .from('payout_records')
      .update({
        payout_status: status,
        payout_reference: reference,
        payout_date: payoutDate || null,
        notes,
      })
      .eq('id', payout.id)

    setEditing(false)
    setLoading(false)
    router.refresh()
  }

  if (editing) {
    return (
      <tr className="bg-secondary/30">
        <td colSpan={5} className="px-4 py-4">
          <div className="space-y-3">
            <p className="font-medium text-foreground">{worker?.first_name} {worker?.last_name} · {gig?.title}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="field-label">Status</label>
                <select
                  className="field-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PayoutStatus)}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="field-label">PayPal reference</label>
                <input
                  type="text"
                  className="field-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction ID"
                />
              </div>
              <div>
                <label className="field-label">Payout date</label>
                <input
                  type="date"
                  className="field-input"
                  value={payoutDate}
                  onChange={(e) => setPayoutDate(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Notes</label>
                <input
                  type="text"
                  className="field-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="accent" loading={loading} onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{worker?.first_name} {worker?.last_name}</p>
        <p className="text-xs text-muted-foreground">{worker?.paypal_email}</p>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{gig?.title}</td>
      <td className="px-4 py-3 font-mono font-medium text-foreground">{formatCurrency(payout.amount)}</td>
      <td className="px-4 py-3">
        <span className={payoutStatusClass(payout.payout_status)}>{payoutStatusLabel(payout.payout_status)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Update</Button>
      </td>
    </tr>
  )
}
