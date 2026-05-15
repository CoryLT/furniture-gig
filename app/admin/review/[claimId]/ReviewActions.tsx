'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface Props {
  claimId: string
  gigId: string
  workerId: string
  payAmount: number
}

export default function ReviewActions({ claimId, gigId, workerId, payAmount }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function handleApprove() {
    setLoading('approve')
    setError('')

    // Update claim
    await supabase
      .from('gig_claims')
      .update({ status: 'approved' })
      .eq('id', claimId)

    // Update gig status
    await supabase
      .from('gigs')
      .update({ status: 'completed' })
      .eq('id', gigId)

    // Create payout record
    const { error: payoutError } = await supabase
      .from('payout_records')
      .insert({
        gig_id: gigId,
        worker_user_id: workerId,
        amount: payAmount,
        payout_status: 'unpaid',
      })

    if (payoutError) {
      setError('Claim approved but failed to create payout record. Please add manually.')
    }

    router.push('/admin/payouts')
    router.refresh()
  }

  async function handleReject() {
    setLoading('reject')
    setError('')

    // Update claim back to active so worker can re-submit
    await supabase
      .from('gig_claims')
      .update({ status: 'active' })
      .eq('id', claimId)

    // Gig goes back to claimed
    await supabase
      .from('gigs')
      .update({ status: 'claimed' })
      .eq('id', gigId)

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="card card-body space-y-4">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Review decision</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Approving will mark the gig as completed and create a payout record for{' '}
          <strong>{formatCurrency(payAmount)}</strong>. Rejecting sends the work back to the worker.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button
          variant="accent"
          loading={loading === 'approve'}
          disabled={loading === 'reject'}
          onClick={handleApprove}
        >
          Approve & create payout
        </Button>
        <Button
          variant="outline"
          loading={loading === 'reject'}
          disabled={loading === 'approve'}
          onClick={handleReject}
          className="text-destructive hover:text-destructive"
        >
          Send back for revision
        </Button>
      </div>
    </div>
  )
}
