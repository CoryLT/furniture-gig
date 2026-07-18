'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  conversationId: string
}

// Textarea + Send button for admins to reply to a support
// conversation. Posts to /api/admin/support/reply and refreshes
// the page so the new message appears at the bottom of the log.
export default function AdminReplyBox({ conversationId }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    const message = text.trim()
    if (!message || busy) return
    setBusy(true)
    setError('')

    try {
      const res = await fetch('/api/admin/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data?.error || 'Failed to send.')
        setBusy(false)
        return
      }

      setText('')
      setBusy(false)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Network error.')
      setBusy(false)
    }
  }

  return (
    <div className="border border-stone-200 rounded-lg bg-white p-4 mt-4">
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">
        Reply as admin
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex flex-col gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Type your reply. The user will get a push notification."
          rows={4}
          disabled={busy}
          className="w-full resize-y border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500">
            Cmd/Ctrl + Enter to send.
          </span>
          <Button type="submit" disabled={!text.trim() || busy} size="sm">
            <Send className="w-4 h-4 mr-1" />
            {busy ? 'Sending…' : 'Send reply'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </div>
  )
}
