'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

// Client button that redeems the free-year comp. On success we
// refresh the page (server component re-renders into the "already
// redeemed" state) instead of doing our own in-place UI switch,
// so both entry paths render the same "redeemed" copy.
export default function AcceptOfferButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/offer/free-year/accept', {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.')
        setBusy(false)
        return
      }
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Network error. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-accent px-5 py-3 font-medium text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-accent/60"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Activating your year…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Activate my free year
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-700 mt-2 text-center">{error}</p>
      )}
    </div>
  )
}
