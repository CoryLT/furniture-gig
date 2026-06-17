'use client'

import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type Handles = {
  cashapp: string
  venmo: string
  paypal: string
  zelle: string
  preferred: string
}

const EMPTY: Handles = { cashapp: '', venmo: '', paypal: '', zelle: '', preferred: '' }

const METHODS: { key: keyof Handles; label: string; placeholder: string; hint: string }[] = [
  { key: 'cashapp', label: 'Cash App', placeholder: '$YourCashtag', hint: 'Your $cashtag' },
  { key: 'venmo', label: 'Venmo', placeholder: '@your-handle', hint: 'Your @username' },
  { key: 'paypal', label: 'PayPal', placeholder: 'you@email.com or paypal.me/you', hint: 'Email or PayPal.me link' },
  { key: 'zelle', label: 'Zelle', placeholder: 'phone or email', hint: 'Phone number or email on Zelle' },
]

// The worker_payout_handles table is intentionally not yet in the generated
// Supabase types, so we talk to it through an untyped client. This matches the
// codebase's existing pattern of `as any` around newer columns/tables.
export default function PayoutHandlesSection() {
  const supabase = createClient()
  const db = supabase as any

  const [handles, setHandles] = useState<Handles>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (active) setLoading(false)
        return
      }
      const { data } = await db
        .from('worker_payout_handles')
        .select('cashapp, venmo, paypal, zelle, preferred')
        .eq('user_id', user.id)
        .maybeSingle()
      if (active && data) {
        setHandles({
          cashapp: data.cashapp ?? '',
          venmo: data.venmo ?? '',
          paypal: data.paypal ?? '',
          zelle: data.zelle ?? '',
          preferred: data.preferred ?? '',
        })
      }
      if (active) setLoading(false)
    }
    load()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(key: keyof Handles, value: string) {
    setHandles((h) => ({ ...h, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('You need to be signed in to save.')
      setSaving(false)
      return
    }
    const { error: saveError } = await db.from('worker_payout_handles').upsert(
      {
        user_id: user.id,
        cashapp: handles.cashapp.trim(),
        venmo: handles.venmo.trim(),
        paypal: handles.paypal.trim(),
        zelle: handles.zelle.trim(),
        preferred: handles.preferred,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (saveError) {
      setError('Could not save. Please try again.')
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  const anyFilled = !!(handles.cashapp || handles.venmo || handles.paypal || handles.zelle)

  return (
    <div className="bg-card rounded-lg shadow p-8 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-5 h-5 text-foreground" />
        <h2 className="text-2xl font-serif font-bold text-foreground">How you get paid</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Add the apps you already use. When a poster picks you, they&apos;ll pay you directly on one of
        these — no account to set up, no waiting. Only a poster who has booked you can see these.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          {METHODS.map((m) => (
            <div key={m.key}>
              <label className="block text-sm font-medium text-foreground mb-1">{m.label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={handles[m.key]}
                  onChange={(e) => update(m.key, e.target.value)}
                  placeholder={m.placeholder}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                  <input
                    type="radio"
                    name="preferred-payout"
                    checked={handles.preferred === m.key}
                    onChange={() => update('preferred', m.key)}
                  />
                  Preferred
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{m.hint}</p>
            </div>
          ))}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Saved.</p>}

          <div className="pt-2">
            <Button onClick={handleSave} loading={saving}>
              Save payment info
            </Button>
          </div>

          {!anyFilled && (
            <p className="text-xs text-muted-foreground">
              Add at least one so posters can pay you when you finish a gig.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
