'use client'

import { useState } from 'react'

export default function TestConnectionButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function run() {
    setStatus('loading')
    setMsg('')
    try {
      const res = await fetch('/api/quickbooks/test')
      const json = await res.json()
      if (json.ok) {
        setStatus('ok')
        setMsg(json.companyName || 'Connected')
      } else {
        setStatus('error')
        setMsg(json.error || 'Failed')
      }
    } catch {
      setStatus('error')
      setMsg('Failed')
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={run}
        disabled={status === 'loading'}
        className="text-sm text-accent hover:underline disabled:opacity-50"
      >
        {status === 'loading' ? 'Checking…' : 'Test connection'}
      </button>
      {status === 'ok' && (
        <p className="text-xs text-foreground">
          Reached QuickBooks: <span className="font-medium">{msg}</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600">Couldn&apos;t reach QuickBooks ({msg})</p>
      )}
    </div>
  )
}
