'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { calculatePaymentBreakdown } from '@/lib/payment-math'

interface Props {
  claimId: string
  gigId: string
  workerId: string
  payAmount: number
}

export default function FlipperReviewActions({
  claimId,
  gigId,
  workerId,
  payAmount,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  // Real charge: capturing the hold charges the full total (gig + your fee +
  // card processing) and sends the worker the full gig amount.
  const b = calculatePaymentBreakdown(payAmount)

  async function handleApprove() {
    setLoading('approve')
    setError('')

    // 1) Capture the held Stripe payment. Phase 4: Stripe charges the
    //    flipper and auto-transfers the worker's cut to their Stripe
    //    Connect account.
    //
    //    The route is idempotent and gracefully handles legacy gigs
    //    with no Stripe PaymentIntent (returns ok with captured:false).
    //    We bail out on any error and leave the DB untouched so the
    //    flipper can retry.
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
      //    .select() forces Supabase to return the updated rows so we
      //    can detect RLS-blocked writes (which otherwise silently
      //    return no error AND no rows changed).
      const { data: claimUpdate, error: claimUpdateErr } = await (supabase as any)
        .from('gig_claims')
        .update({ status: 'approved' })
        .eq('id', claimId)
        .select('id')

      if (claimUpdateErr || !claimUpdate || claimUpdate.length === 0) {
        setError(
          'Payment captured, but could not mark the claim as approved. ' +
            'Please contact support — your money was charged. ' +
            (claimUpdateErr?.message ?? '')
        )
        setLoading(null)
        return
      }

      // 3) Mark the gig completed.
      const { data: gigUpdate, error: gigUpdateErr } = await (supabase as any)
        .from('gigs')
        .update({ status: 'completed' })
        .eq('id', gigId)
        .select('id')

      if (gigUpdateErr || !gigUpdate || gigUpdate.length === 0) {
        // Claim already flipped to approved — partial state but not fatal.
        // Log to console and continue; gig status can be cleaned up later.
        console.warn('[approve] Gig status update may have failed:', gigUpdateErr)
      }

      // 4) Legacy fallback: if there's no payout_records row at all
      //    (gigs from before Phase 3), make one now so the payouts
      //    page has something to show.
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

      // Send the flipper back to the gig view, which will now show
      // the gig as completed.
      router.push(`/flipper/gigs/${gigId}`)
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
    // their work and resubmit without forcing a re-pick.
    //
    // Note: Stripe card authorizations expire after ~7 days. If the
    // worker takes longer than that to resubmit, the auth will lapse
    // (no charge to the flipper) and a fresh re-pick would be needed
    // to capture later. Permanent-reject UI can come later.
    const { data: rejectUpdate, error: rejectUpdateErr } = await (supabase as any)
      .from('gig_claims')
      .update({ status: 'active' })
      .eq('id', claimId)
      .select('id')

    if (rejectUpdateErr || !rejectUpdate || rejectUpdate.length === 0) {
      setError(
        'Could not send back for revision. ' +
          (rejectUpdateErr?.message ?? 'RLS may be blocking the update.')
      )
      setLoading(null)
      return
    }

    await (supabase as any)
      .from('gigs')
      .update({ status: 'claimed' })
      .eq('id', gigId)

    router.push(`/flipper/gigs/${gigId}`)
    router.refresh()
  }

  return (
    <div className="card card-body space-y-4">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Review decision</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Approving will charge your card{' '}
          <strong>{formatCurrency(b.grossDollars)}</strong> and send the worker
          their full <strong>{formatCurrency(b.workerReceivesDollars)}</strong>{' '}
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
