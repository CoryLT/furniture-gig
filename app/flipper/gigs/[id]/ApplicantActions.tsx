'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import AddPaymentMethodModal from '@/components/shared/AddPaymentMethodModal'
import PickWorkerConfirmModal from '@/components/shared/PickWorkerConfirmModal'

// Module-level cache — loadStripe should be called once.
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

interface Props {
  claimId: string
  workerName: string
  gigTitle: string
  payAmount: number
}

interface SavedCardInfo {
  brand: string | null
  last4: string | null
}

export default function ApplicantActions({
  claimId,
  workerName,
  gigTitle,
  payAmount,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [pendingPickAfterCard, setPendingPickAfterCard] = useState(false)

  // Confirm-modal state. Opens AFTER we verify a card exists on file.
  // The flipper must explicitly click Confirm in the modal before any
  // money-moving Stripe call fires.
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [savedCard, setSavedCard] = useState<SavedCardInfo | null>(null)

  /**
   * Calls /api/stripe/pick-worker.
   * That endpoint authorizes the payment (holds money), saves the payout row,
   * and calls approve_applicant — all in one server-side transaction.
   *
   * If Stripe demands 3D Secure, we walk the flipper through it here, then
   * re-call the endpoint to finish.
   */
  async function runApprove() {
    setLoading('approve')
    setError('')

    try {
      const res = await fetch('/api/stripe/pick-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      })
      const data = await res.json()

      if (res.ok && data.status === 'ok') {
        router.refresh()
        return
      }

      // 3D Secure path
      if (data.status === 'requires_action' && data.clientSecret) {
        if (!stripePromise) {
          setError(
            'Stripe is not configured. Please contact support.'
          )
          setLoading(null)
          return
        }
        const stripe = await stripePromise
        if (!stripe) {
          setError('Could not load Stripe. Try again in a moment.')
          setLoading(null)
          return
        }

        // Confirm the PaymentIntent with the bank's 3DS challenge.
        const { error: confirmError } = await stripe.confirmCardPayment(
          data.clientSecret
        )
        if (confirmError) {
          setError(
            confirmError.message ||
              'Card verification failed. Please try a different card.'
          )
          setLoading(null)
          return
        }

        // 3DS passed. Re-call the endpoint — Stripe's idempotency key (tied to
        // the claim ID) means we'll get the same PaymentIntent back, now in
        // requires_capture state, and the rest of the flow will run.
        const retryRes = await fetch('/api/stripe/pick-worker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId }),
        })
        const retryData = await retryRes.json()

        if (retryRes.ok && retryData.status === 'ok') {
          router.refresh()
          return
        }

        setError(
          retryData?.error ||
            'Could not finish the pick after card verification.'
        )
        setLoading(null)
        return
      }

      // Generic error
      setError(data?.error || data?.message || 'Could not pick this worker.')
      setLoading(null)
    } catch (err: any) {
      setError(err?.message || 'Could not pick this worker.')
      setLoading(null)
    }
  }

  async function handleApprove() {
    setError('')
    setLoading('approve')

    // First check if a card is on file. The server returns the card
    // brand + last-4 along with the boolean so we can show them in the
    // confirmation modal.
    try {
      const res = await fetch('/api/stripe/payment-method/status')
      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || data?.message || 'Could not check payment method.')
        setLoading(null)
        return
      }

      if (!data.hasPaymentMethod) {
        // No card on file — open the Add-a-card modal. Once the card
        // is saved we'll come back through handleCardSaved which will
        // re-run handleApprove to surface the confirm modal.
        setPendingPickAfterCard(true)
        setPaymentModalOpen(true)
        setLoading(null)
        return
      }

      // Card on file — capture the first card's brand + last-4 so the
      // confirm modal can show them.
      const first = data.paymentMethods?.[0]
      setSavedCard({
        brand: first?.brand ?? null,
        last4: first?.last4 ?? null,
      })
      // Show the confirm modal. The actual Stripe authorization only
      // fires AFTER the flipper clicks the confirm button in the modal.
      setConfirmModalOpen(true)
      setLoading(null)
    } catch (err: any) {
      setError(err?.message || 'Could not check payment method.')
      setLoading(null)
    }
  }

  // Called when the flipper clicks Confirm in the PickWorkerConfirmModal.
  async function handleConfirmedPick() {
    setLoading('approve')
    await runApprove()
    // Close the modal AFTER runApprove resolves. runApprove already
    // does router.refresh() on success which will rerender this row
    // (probably unmounting it), so this close call is a no-op then.
    // On failure, runApprove sets `error` so the flipper sees the
    // problem; we still close the modal so they aren't trapped.
    setConfirmModalOpen(false)
  }

  function handleConfirmedCancel() {
    if (loading === 'approve') return // don't allow cancel mid-flight
    setConfirmModalOpen(false)
    setSavedCard(null)
  }

  async function handleReject() {
    if (!confirm(`Reject ${workerName}'s application? They'll get a polite message about it.`)) {
      return
    }
    setLoading('reject')
    setError('')

    const { error: rpcError } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: { message?: string } | null }>)('reject_applicant', {
      p_claim_id: claimId,
    })

    if (rpcError) {
      setError(rpcError.message || 'Could not reject applicant.')
      setLoading(null)
      return
    }

    router.refresh()
  }

  // Called when AddPaymentMethodModal reports a saved card.
  // We deliberately re-run handleApprove instead of calling runApprove
  // directly — that routes through the confirm modal so the flipper
  // can see the amount + their newly-saved card before money is held.
  async function handleCardSaved() {
    setPaymentModalOpen(false)
    if (pendingPickAfterCard) {
      setPendingPickAfterCard(false)
      await handleApprove()
    }
  }

  function handleModalClose() {
    setPaymentModalOpen(false)
    setPendingPickAfterCard(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant="accent"
          size="sm"
          loading={loading === 'approve'}
          disabled={!!loading}
          onClick={handleApprove}
        >
          Pick this worker
        </Button>
        <Button
          variant="outline"
          size="sm"
          loading={loading === 'reject'}
          disabled={!!loading}
          onClick={handleReject}
        >
          Reject
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <AddPaymentMethodModal
        open={paymentModalOpen}
        onClose={handleModalClose}
        onSuccess={handleCardSaved}
      />

      <PickWorkerConfirmModal
        open={confirmModalOpen}
        workerName={workerName}
        gigTitle={gigTitle}
        payAmount={payAmount}
        savedCard={savedCard}
        loading={loading === 'approve'}
        onCancel={handleConfirmedCancel}
        onConfirm={handleConfirmedPick}
      />
    </div>
  )
}
