'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface Props {
  gigId: string
  amount: number
}

const METHOD_LABELS: Record<string, string> = {
  cashapp: 'Cash App',
  venmo: 'Venmo',
  paypal: 'PayPal',
  zelle: 'Zelle',
  cash: 'Cash',
}

export default function ConfirmReceivedCard({ gigId, amount }: Props) {
  const supabase = createClient()
  const db = supabase as any

  const [payment, setPayment] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await db
        .from('gig_payments')
        .select('*')
        .eq('gig_id', gigId)
        .maybeSingle()
      if (!active) return
      setPayment(data ?? null)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId])

  async function confirmReceived() {
    setSaving(true)
    setError('')
    const { error: e } = await db
      .from('gig_payments')
      .update({
        worker_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('gig_id', gigId)
    if (e) {
      setError('Could not confirm. Please try again.')
      setSaving(false)
      return
    }
    const { data } = await db
      .from('gig_payments')
      .select('*')
      .eq('gig_id', gigId)
      .maybeSingle()
    setPayment(data ?? null)
    setSaving(false)
  }

  if (loading) return null

  if (payment?.worker_confirmed_at) {
    return (
      <div className="card card-body space-y-1">
        <h3 className="font-sans font-semibold text-foreground">✓ Payment confirmed</h3>
        <p className="text-sm text-muted-foreground">
          You confirmed you received {formatCurrency(amount)}. Nice work — this gig is closed out.
        </p>
      </div>
    )
  }

  if (payment?.marked_paid_at) {
    const ml = payment.method ? METHOD_LABELS[payment.method] ?? payment.method : ''
    return (
      <div className="card card-body space-y-3">
        <div>
          <h3 className="font-sans font-semibold text-foreground">Did you get paid?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your poster marked this gig paid{ml ? ` via ${ml}` : ''} — {formatCurrency(amount)}. Check
            your account, then confirm you got it to close out the gig.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button variant="accent" loading={saving} onClick={confirmReceived}>
          Yes, I got my {formatCurrency(amount)}
        </Button>
      </div>
    )
  }

  // Approved, but the poster hasn't marked payment yet.
  return (
    <div className="card card-body">
      <p className="text-sm text-muted-foreground">
        ✓ Your work was approved. Hang tight — your poster will send your {formatCurrency(amount)} and
        mark it paid, and then you can confirm you got it right here.
      </p>
    </div>
  )
}
