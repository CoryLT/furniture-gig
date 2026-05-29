'use client'

import { useEffect } from 'react'
import { CreditCard, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  calculatePaymentBreakdown,
  DEFAULT_PLATFORM_FEE_PERCENT,
} from '@/lib/payment-math'

// ============================================================
// PickWorkerConfirmModal
// ============================================================
// Shown after the flipper clicks "Pick this worker" — confirms the
// money hold before any Stripe call fires.
//
// Key points by design:
//   • Shows the EXACT dollar amount about to be held
//   • Shows the SAVED card's brand + last-4 so the flipper can't be
//     surprised about which card is being used
//   • Spells out that the hold is reversible (no capture until work
//     is approved)
//   • Confirm button is the only path that actually triggers the
//     /api/stripe/pick-worker call.
//
// Cory's UX rule: a saved card should never be used silently — the
// flipper should consciously confirm both the amount and the card
// for every pick, even though a card is on file.
// ============================================================

interface SavedCard {
  brand: string | null
  last4: string | null
}

interface Props {
  open: boolean
  workerName: string
  gigTitle: string
  payAmount: number // dollars (numeric)
  savedCard: SavedCard | null
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function PickWorkerConfirmModal({
  open,
  workerName,
  gigTitle,
  payAmount,
  savedCard,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  // Esc closes the modal (unless an action is in flight)
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  // Real charge breakdown: worker gets the full gig amount; the flipper pays
  // the platform fee + card processing fee on top. This is the SAME math the
  // server uses to charge the card, so the numbers shown here match exactly.
  const b = calculatePaymentBreakdown(payAmount)

  // Format brand for display ("visa" -> "Visa")
  const brandLabel = savedCard?.brand
    ? savedCard.brand.charAt(0).toUpperCase() + savedCard.brand.slice(1)
    : 'Card'
  const last4 = savedCard?.last4 || '••••'

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
            <div className="shrink-0 w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-accent" strokeWidth={1.75} />
            </div>
            <h2 className="font-sans font-semibold text-lg text-foreground leading-tight pt-1">
              Confirm and hold payment
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
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-foreground/80">
            You're about to pick{' '}
            <span className="font-medium text-foreground">{workerName}</span>{' '}
            for <span className="font-medium text-foreground">{gigTitle}</span>.
            We'll place a hold on your card now. Money is{' '}
            <span className="font-medium">not</span> charged until you approve
            their finished work.
          </p>

          {/* Payment breakdown */}
          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Worker receives</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(b.workerReceivesDollars)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Platform fee ({DEFAULT_PLATFORM_FEE_PERCENT}%)
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(b.platformFeeDollars)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Card processing fee</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatCurrency(b.stripeFeeDollars)}
              </span>
            </div>
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Total hold
              </span>
              <span className="text-2xl font-semibold text-foreground tabular-nums">
                {formatCurrency(b.grossDollars)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {brandLabel} •••• {last4}
              </span>
            </div>
          </div>

          {/* Reassurance */}
          <p className="text-xs text-muted-foreground">
            All other applicants for this gig will be automatically declined
            once you confirm.
          </p>
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
            variant="accent"
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
            className="sm:w-auto w-full"
          >
            Hold {formatCurrency(b.grossDollars)} & pick
          </Button>
        </div>
      </div>
    </div>
  )
}
