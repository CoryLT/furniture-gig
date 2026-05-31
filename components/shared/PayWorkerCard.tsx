'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface Props {
  gigId: string
  workerId: string
  workerName: string
  amount: number
  flipperUserId: string
}

type Handles = {
  cashapp: string
  venmo: string
  paypal: string
  zelle: string
  preferred: string
}

const EMPTY_HANDLES: Handles = { cashapp: '', venmo: '', paypal: '', zelle: '', preferred: '' }

const METHOD_LABELS: Record<string, string> = {
  cashapp: 'Cash App',
  venmo: 'Venmo',
  paypal: 'PayPal',
  zelle: 'Zelle',
  cash: 'Cash',
}

// A tap-to-open link to the worker's payment app, where one exists.
function payLink(method: string, handle: string): string | null {
  const h = (handle || '').trim()
  if (!h) return null
  if (method === 'cashapp') return `https://cash.app/$${h.replace(/^\$/, '')}`
  if (method === 'venmo') return `https://venmo.com/u/${h.replace(/^@/, '')}`
  if (method === 'paypal') {
    if (h.includes('@')) return null // it's an email — no clean link
    return `https://paypal.me/${h.replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')}`
  }
  return null
}

export default function PayWorkerCard({ gigId, workerId, workerName, amount, flipperUserId }: Props) {
  const supabase = createClient()
  const db = supabase as any

  const [handles, setHandles] = useState<Handles>(EMPTY_HANDLES)
  const [payment, setPayment] = useState<any | null>(null)
  const [method, setMethod] = useState<string>('cash')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: h }, { data: p }] = await Promise.all([
        db
          .from('worker_payout_handles')
          .select('cashapp, venmo, paypal, zelle, preferred')
          .eq('user_id', workerId)
          .maybeSingle(),
        db.from('gig_payments').select('*').eq('gig_id', gigId).maybeSingle(),
      ])
      if (!active) return
      const hh: Handles = h
        ? {
            cashapp: h.cashapp ?? '',
            venmo: h.venmo ?? '',
            paypal: h.paypal ?? '',
            zelle: h.zelle ?? '',
            preferred: h.preferred ?? '',
          }
        : EMPTY_HANDLES
      setHandles(hh)
      setPayment(p ?? null)
      const filled = (['cashapp', 'venmo', 'paypal', 'zelle'] as const).filter((k) => hh[k])
      const def =
        p?.method ||
        (hh.preferred && hh[hh.preferred as keyof Handles] ? hh.preferred : filled[0] ?? 'cash')
      setMethod(def)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId, workerId])

  async function markPaid() {
    setSaving(true)
    setError('')
    const { error: e } = await db.from('gig_payments').upsert(
      {
        gig_id: gigId,
        worker_user_id: workerId,
        flipper_user_id: flipperUserId,
        amount,
        method,
        marked_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'gig_id' }
    )
    if (e) {
      setError('Could not save. Please try again.')
      setSaving(false)
      return
    }
    const { data: p } = await db.from('gig_payments').select('*').eq('gig_id', gigId).maybeSingle()
    setPayment(p ?? null)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="card card-body">
        <p className="text-sm text-muted-foreground">Loading payment…</p>
      </div>
    )
  }

  if (payment?.worker_confirmed_at) {
    return (
      <div className="card card-body space-y-2">
        <h3 className="font-sans font-semibold text-foreground">✓ Paid &amp; confirmed</h3>
        <p className="text-sm text-muted-foreground">
          {workerName} confirmed they received {formatCurrency(amount)}
          {payment.method ? ` via ${METHOD_LABELS[payment.method] ?? payment.method}` : ''}. All done.
        </p>
      </div>
    )
  }

  if (payment?.marked_paid_at) {
    return (
      <div className="card card-body space-y-2">
        <h3 className="font-sans font-semibold text-foreground">
          Payment sent — waiting on {workerName}
        </h3>
        <p className="text-sm text-muted-foreground">
          You marked this paid
          {payment.method ? ` via ${METHOD_LABELS[payment.method] ?? payment.method}` : ''}. We&apos;ve
          asked {workerName} to confirm they got their {formatCurrency(amount)}. The gig closes once
          they confirm.
        </p>
      </div>
    )
  }

  const methodOptions = (['cashapp', 'venmo', 'paypal', 'zelle'] as const).filter((k) => handles[k])
  const chosenHandle = method !== 'cash' ? handles[method as keyof Handles] : ''
  const link = method !== 'cash' ? payLink(method, String(chosenHandle)) : null

  return (
    <div className="card card-body space-y-4">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Pay {workerName}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Send {workerName} their <strong>{formatCurrency(amount)}</strong> on the app they chose,
          then mark it paid here.
        </p>
      </div>

      {methodOptions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {workerName} hasn&apos;t added a payment app yet. You can still pay in cash and mark it below.
        </p>
      )}

      <div className="space-y-2">
        {methodOptions.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymethod"
              checked={method === k}
              onChange={() => setMethod(k)}
            />
            <span className="font-medium text-foreground">{METHOD_LABELS[k]}:</span>
            <span className="font-mono text-foreground">{handles[k]}</span>
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="paymethod"
            checked={method === 'cash'}
            onChange={() => setMethod('cash')}
          />
          <span className="font-medium text-foreground">Cash (in person)</span>
        </label>
      </div>

      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-block">
          <Button variant="outline" type="button">
            Open {METHOD_LABELS[method]} to pay {formatCurrency(amount)}
          </Button>
        </a>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button variant="accent" loading={saving} onClick={markPaid}>
        Mark as paid
      </Button>
    </div>
  )
}
