'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Loader2 } from 'lucide-react'

interface Props {
  gigId: string
  // When the flipper opens chat, they must say which applicant.
  // Workers can leave this undefined — the API will default to caller.
  otherUserId?: string
  label?: string
  className?: string
}

export default function OpenChatButton({
  gigId,
  otherUserId,
  label = 'Message',
  className = '',
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gigId,
          ...(otherUserId ? { workerUserId: otherUserId } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.conversationId) {
        setError(data.error || 'Could not open chat')
        setLoading(false)
        return
      }
      router.push(`/messages/${data.conversationId}`)
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ||
          'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        }
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
        {label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
