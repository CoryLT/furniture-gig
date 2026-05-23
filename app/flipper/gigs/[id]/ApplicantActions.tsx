'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import AddPaymentMethodModal from '@/components/shared/AddPaymentMethodModal'

interface Props {
  claimId: string
  workerName: string
}

export default function ApplicantActions({ claimId, workerName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [pendingPickAfterCard, setPendingPickAfterCard] = useState(false)

  /**
   * Actually runs the DB approve. Assumes payment method check already passed.
   */
  async function runApprove() {
    setLoading('approve')
    setError('')

    const { error: rpcError } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: { message?: string } | null }>)('approve_applicant', {
      p_claim_id: claimId,
    })

    if (rpcError) {
      setError(rpcError.message || 'Could not approve applicant.')
      setLoading(null)
      return
    }

    router.refresh()
  }

  async function handleApprove() {
    if (!confirm(`Pick ${workerName} for this gig? Everyone else who applied will be rejected.`)) {
      return
    }

    setError('')
    setLoading('approve')

    // Check if flipper has a saved card BEFORE locking the claim in
    try {
      const res = await fetch('/api/stripe/payment-method/status')
      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || data?.message || 'Could not check payment method.')
        setLoading(null)
        return
      }

      if (!data.hasPaymentMethod) {
        // Open modal — when card is saved, we'll auto-resume the pick
        setPendingPickAfterCard(true)
        setPaymentModalOpen(true)
        setLoading(null)
        return
      }

      // Has a card — go straight to approve
      await runApprove()
    } catch (err: any) {
      setError(err?.message || 'Could not check payment method.')
      setLoading(null)
    }
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

  // Called when AddPaymentMethodModal reports a saved card
  async function handleCardSaved() {
    setPaymentModalOpen(false)
    if (pendingPickAfterCard) {
      setPendingPickAfterCard(false)
      await runApprove()
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
    </div>
  )
}
