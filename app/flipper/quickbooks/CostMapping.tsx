'use client'

import { useEffect, useState } from 'react'

type Account = { id: string; name: string }

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'purchase', label: 'Purchase (the item itself)' },
  { key: 'materials', label: 'Materials' },
  { key: 'labor', label: 'Labor' },
  { key: 'transport', label: 'Transport' },
  { key: 'fees', label: 'Fees' },
  { key: 'other', label: 'Other' },
]

export default function CostMapping() {
  const [loading, setLoading] = useState(true)
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [paidFromAccounts, setPaidFromAccounts] = useState<Account[]>([])
  const [map, setMap] = useState<Record<string, string>>({})
  const [paidFromId, setPaidFromId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [accRes, setRes] = await Promise.all([
          fetch('/api/quickbooks/accounts'),
          fetch('/api/quickbooks/settings'),
        ])
        const acc = await accRes.json()
        const set = await setRes.json()
        if (!active) return
        if (acc.ok) {
          setExpenseAccounts(acc.categories || [])
          setPaidFromAccounts(acc.paidFrom || [])
        }
        if (set.ok) {
          setMap(set.categoryMap || {})
          setPaidFromId(set.paidFromAccountId || '')
        }
      } catch {
        if (active) setError('Could not load your QuickBooks accounts.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/quickbooks/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidFromAccountId: paidFromId, categoryMap: map }),
      })
      const json = await res.json()
      if (!json.ok) {
        setError('Could not save. Please try again.')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Could not save. Please try again.')
    }
    setSaving(false)
  }

  const selectCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  return (
    <div className="card card-body space-y-3">
      <div>
        <p className="font-medium text-foreground">How your costs map to QuickBooks</p>
        <p className="text-xs text-muted-foreground">
          Pick which QuickBooks account each kind of cost should file under. You only
          do this once.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your accounts…</p>
      ) : expenseAccounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No expense accounts came back from QuickBooks. Try again in a moment.
        </p>
      ) : (
        <>
          <label className="text-xs text-muted-foreground block">
            Paid from (default account money comes out of)
            <select
              value={paidFromId}
              onChange={(e) => {
                setPaidFromId(e.target.value)
                setSaved(false)
              }}
              className={selectCls}
            >
              <option value="">Choose an account</option>
              {paidFromAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <div className="border-t border-border pt-3 space-y-3">
            {CATEGORIES.map((c) => (
              <label key={c.key} className="text-xs text-muted-foreground block">
                {c.label}
                <select
                  value={map[c.key] || ''}
                  onChange={(e) => {
                    setMap((prev) => ({ ...prev, [c.key]: e.target.value }))
                    setSaved(false)
                  }}
                  className={selectCls}
                >
                  <option value="">Choose an account</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-accent">Saved.</p>}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 w-fit transition-colors"
          >
            {saving ? 'Saving\u2026' : 'Save mapping'}
          </button>
        </>
      )}
    </div>
  )
}
