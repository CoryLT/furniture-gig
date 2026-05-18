'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'

interface Props {
  imageKind: 'avatar' | 'flipper_gallery' | 'worker_gallery' | 'gig_photo' | 'gig_image'
  filePath: string
  bucket: string
  sourceRowId?: string
  ownerUserId?: string
  /** Optional className to position the button (e.g. absolute over a photo) */
  className?: string
}

export default function ReportImageButton({
  imageKind,
  filePath,
  bucket,
  sourceRowId,
  ownerUserId,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Please tell us briefly why you\'re reporting this image.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/report-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageKind,
          filePath,
          bucket,
          sourceRowId,
          ownerUserId,
          reason: reason.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not file report.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError('Network error.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report this image"
        className={
          className ||
          'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors'
        }
      >
        <Flag className="w-3.5 h-3.5" />
        Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-foreground">Report this image</h3>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {done ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground">
                  Thanks for letting us know. An admin will review your report.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    // reset for if button is reused
                    setTimeout(() => {
                      setDone(false)
                      setReason('')
                    }, 200)
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  What&apos;s wrong with this image? Be specific so the admin can review it
                  quickly.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Example: this looks like spam, doesn't show furniture, contains personal info..."
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={submitting}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Submit report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
