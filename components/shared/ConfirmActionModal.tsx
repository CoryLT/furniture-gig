'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  title: string
  description: string
  // Optional: require the user to type this exact string to enable
  // the confirm button. Use for destructive irreversible actions.
  typeToConfirm?: string
  confirmLabel?: string
  confirmVariant?: 'destructive' | 'accent' | 'default'
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * In-page confirmation modal.
 *
 * Replaces native window.confirm() which is unreliable on mobile
 * browsers (Safari iOS in particular sometimes blocks confirm() called
 * after async work, and PWA / installed-app contexts hide it entirely).
 * This component shows a styled overlay with Cancel + Confirm buttons,
 * and works the same on every device.
 *
 * If typeToConfirm is provided, the confirm button stays disabled
 * until the user types the exact string (case-sensitive).
 */
export default function ConfirmActionModal({
  open,
  title,
  description,
  typeToConfirm,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('')

  // Reset the typed input every time the modal opens, so a previous
  // attempt's input doesn't carry over.
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const typeMatches = !typeToConfirm || typed === typeToConfirm
  const disabled = loading || !typeMatches

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!loading) onCancel()
      }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-card border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle
                className="w-5 h-5 text-destructive"
                strokeWidth={1.75}
              />
            </div>
            <h2 className="font-sans font-semibold text-lg text-foreground leading-tight pt-1">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground p-1 -m-1 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-foreground/80 whitespace-pre-line">
            {description}
          </p>

          {typeToConfirm && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Type{' '}
                <span className="font-mono text-foreground">
                  {typeToConfirm}
                </span>{' '}
                to confirm
              </label>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={typeToConfirm}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="sm:w-auto w-full"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={disabled}
            loading={loading}
            className="sm:w-auto w-full"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
