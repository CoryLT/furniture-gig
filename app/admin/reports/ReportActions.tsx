'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  bucket: string
  filePath: string
  imageKind: string
}

export default function ReportActions({ reportId, bucket, filePath, imageKind }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'remove' | 'keep' | 'dismiss' | null>(null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')

  async function callAction(action: 'remove' | 'keep' | 'dismiss') {
    const confirmMsg =
      action === 'remove'
        ? 'Permanently delete this image? This cannot be undone.'
        : action === 'keep'
          ? 'Mark this image as reviewed and OK to keep?'
          : 'Dismiss this report (e.g. as spam or invalid)?'

    if (!confirm(confirmMsg)) return

    setLoading(action)
    setError('')

    try {
      const res = await fetch('/api/admin/resolve-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          action,
          bucket,
          filePath,
          imageKind,
          adminNotes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Action failed.')
        setLoading(null)
        return
      }
      router.refresh()
    } catch {
      setError('Network error.')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Optional admin notes…"
        className="w-full px-2 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-accent"
        disabled={!!loading}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => callAction('remove')}
          disabled={!!loading}
          className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {loading === 'remove' ? 'Removing…' : 'Remove image'}
        </button>
        <button
          type="button"
          onClick={() => callAction('keep')}
          disabled={!!loading}
          className="px-3 py-1.5 text-xs rounded-md bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          {loading === 'keep' ? 'Keeping…' : 'Keep image'}
        </button>
        <button
          type="button"
          onClick={() => callAction('dismiss')}
          disabled={!!loading}
          className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loading === 'dismiss' ? 'Dismissing…' : 'Dismiss report'}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
