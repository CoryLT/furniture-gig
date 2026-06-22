'use client'

import { useState } from 'react'

export function UpgradeButton({ label = 'Upgrade to Pro' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function go() {
    setErr('')
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const json = await res.json()
      if (json?.url) {
        window.location.href = json.url
        return
      }
      setErr(json?.error || 'Could not start checkout.')
    } catch {
      setErr('Could not start checkout.')
    }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={loading}
        className="w-full rounded-lg bg-accent px-5 py-3 text-center font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
      >
        {loading ? 'Starting…' : label}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  )
}

export function ManageButton({ label = 'Manage subscription' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function go() {
    setErr('')
    setLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (json?.url) {
        window.location.href = json.url
        return
      }
      setErr(json?.error || 'Could not open the billing portal.')
    } catch {
      setErr('Could not open the billing portal.')
    }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={loading}
        className="w-full rounded-lg border border-border px-5 py-3 text-center font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading ? 'Opening…' : label}
      </button>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  )
}
