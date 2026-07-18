'use client'

import { useState } from 'react'

// A tiny undo affordance under the unsubscribe confirmation. If a
// preview fetcher (or a distracted user) triggered the unsub, one
// click puts them back on the list. Posts to /api/unsubscribe/undo
// with the token — no login required.
export default function ResubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  async function resubscribe() {
    if (state === 'busy' || state === 'done') return
    setState('busy')
    try {
      const res = await fetch('/api/unsubscribe/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        setState('error')
        return
      }
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="text-sm text-green-700">
        Re-subscribed. Welcome back — you&rsquo;ll receive our next update.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={resubscribe}
        disabled={state === 'busy'}
        className="text-sm underline text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {state === 'busy' ? 'Re-subscribing…' : 'Unsubscribed by accident? Undo'}
      </button>
      {state === 'error' && (
        <p className="text-xs text-red-700">
          Couldn&rsquo;t re-subscribe right now. Try again in a moment.
        </p>
      )}
    </div>
  )
}
