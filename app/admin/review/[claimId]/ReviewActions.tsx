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

    // 1) Capture the held Stripe payment. Phase 4 step: Stripe charges
    //    the flipper and auto-transfers the worker's cut to their
    //    Stripe Connect account.
    //
    //    The route is idempotent and gracefully handles the legacy
    //    case where a gig has no Stripe PaymentIntent (returns ok with
    //    captured: false). We bail out on any error and leave the DB
    //    untouched so admin can retry.
    try {
      const res = await fetch('/api/stripe/capture-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Could not capture payment. Try again.')
        setLoading(null)
        return
      }

      // 2) Mark the claim as approved.
      await supabase
        .from('gig_claims')
        .update({ status: 'approved' })
        .eq('id', claimId)

      // 3) Mark the gig completed.
      await supabase
        .from('gigs')
        .update({ status: 'completed' })
        .eq('id', gigId)

      // 4) Legacy fallback: if there's no payout_records row at all
      //    (gigs from before Phase 3), make one now so the admin
      //    payouts page has something to show.
      if (data?.captured === false) {
        const { data: existing } = await (supabase as any)
          .from('payout_records')
          .select('id')
          .eq('gig_id', gigId)
          .eq('worker_user_id', workerId)
          .limit(1)
          .maybeSingle()

        if (!existing) {
          await (supabase as any)
            .from('payout_records')
            .insert({
              gig_id: gigId,
              worker_user_id: workerId,
              amount: payAmount,
              payout_status: 'unpaid',
              payment_status: 'none',
            })
        }
      }

      router.push('/admin/payouts')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
      setLoading(null)
    }
  }

  async function handleReject() {
    setLoading('reject')
    setError('')

    // "Send back for revision" — does NOT release the Stripe
    // authorization. The hold stays in place so the worker can fix
    // their work and resubmit without forcing the flipper to re-pick.
    //
    // Note: Stripe card authorizations expire after ~7 days. If the
    // worker takes longer than that to resubmit, the auth will lapse
    // on its own (no charge to the flipper) and a fresh re-pick would
    // be needed to capture later. Permanent-reject UI can come later.
    await supabase
      .from('gig_claims')
      .update({ status: 'active' })
      .eq('id', claimId)

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
          Approving will charge the flipper&apos;s card{' '}
          <strong>{formatCurrency(payAmount)}</strong> and send the worker their
          payout automatically via Stripe. Rejecting sends the work back to the
          worker (the hold stays in place).
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
          Approve &amp; capture payment
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
