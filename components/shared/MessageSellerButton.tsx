'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Loader2 } from 'lucide-react'

interface Props {
  listingId: string
  label?: string
  className?: string
}

// "Message Seller" button on a marketplace listing detail page.
//
// On click:
//   POST /api/listing-messages/start { listingId }
// then:
//   router.push(`/messages/${conversationId}`)
//
// The /messages/[conversationId] route will be updated to handle
// listing conversations alongside gig conversations.
export default function MessageSellerButton({
  listingId,
  label = 'Message Seller',
  className = '',
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/listing-messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      if (!res.ok || !data.conversationId) {
        setError(data.error || 'Could not open chat')
        setLoading(false)
        return
      }
      router.push(`/messages/${data.conversationId}`)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ||
          'w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        }
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
        {label}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1 text-center">{error}</p>
      )}
    </div>
  )
}
