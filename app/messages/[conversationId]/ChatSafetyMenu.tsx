'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Ban, Flag, Loader2 } from 'lucide-react'

interface Props {
  otherUserId: string
  conversationKind: 'gig' | 'listing' | 'user'
  conversationId: string
  initialBlocked?: boolean
}

export default function ChatSafetyMenu({
  otherUserId,
  conversationKind,
  conversationId,
  initialBlocked = false,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [blocked, setBlocked] = useState(initialBlocked)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)

  async function toggleBlock() {
    setBusy(true)
    setNote('')
    try {
      const res = await fetch('/api/users/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: otherUserId,
          action: blocked ? 'unblock' : 'block',
        }),
      })
      if (res.ok) {
        const nowBlocked = !blocked
        setBlocked(nowBlocked)
        setNote(nowBlocked ? 'User blocked.' : 'User unblocked.')
        setOpen(false)
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        setNote(d?.error || 'Action failed')
      }
    } catch {
      setNote('Network error')
    } finally {
      setBusy(false)
    }
  }

  async function submitReport() {
    setBusy(true)
    setNote('')
    try {
      const res = await fetch('/api/messages/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationKind,
          conversationId,
          reason: reportReason,
        }),
      })
      if (res.ok) {
        setReporting(false)
        setReportReason('')
        setOpen(false)
        setNote('Report submitted. Thank you.')
      } else {
        const d = await res.json().catch(() => ({}))
        setNote(d?.error || 'Could not submit report')
      }
    } catch {
      setNote('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setReporting(false)
        }}
        className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Safety options"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-60 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {!reporting ? (
              <div className="py-1">
                <button
                  type="button"
                  onClick={toggleBlock}
                  disabled={busy}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  {blocked ? 'Unblock user' : 'Block user'}
                </button>
                <button
                  type="button"
                  onClick={() => setReporting(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                >
                  <Flag className="w-4 h-4" />
                  Report conversation
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Report this conversation
                </p>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value.slice(0, 1000))}
                  rows={3}
                  placeholder="Tell us what's wrong (optional)"
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit report
                  </button>
                  <button
                    type="button"
                    onClick={() => setReporting(false)}
                    className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {note && (
        <p className="absolute right-0 top-full mt-1 text-xs text-muted-foreground whitespace-nowrap bg-card px-2 py-1 rounded shadow-sm border border-border">
          {note}
        </p>
      )}
    </div>
  )
}
