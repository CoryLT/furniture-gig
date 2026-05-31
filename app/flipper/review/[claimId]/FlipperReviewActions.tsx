'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface Props {
  claimId: string
  gigId: string
  workerId: string
  payAmount: number
}

export default function FlipperReviewActions({ claimId, gigId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function handleApprove() {
    setLoading('approve')
    setError('')
    // Accept the work. No charge here — the poster pays the worker directly
    // in the next step (the pay card). We mark the claim approved and stay
    // on this page so that card appears.
    const { data: claimUpdate, error: claimUpdateErr } = await (supabase as any)
      .from('gig_claims')
      .update({ status: 'approved' })
      .eq('id', claimId)
      .select('id')

    if (claimUpdateErr || !claimUpdate || claimUpdate.length === 0) {
      setError('Could not approve the work. ' + (claimUpdateErr?.message ?? ''))
      setLoading(null)
      return
    }
    router.refresh()
  }

  async function handleReject() {
    setLoading('reject')
    setError('')
    // Send the work back for revision — claim returns to active.
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

    await (supabase as any).from('gigs').update({ status: 'claimed' }).eq('id', gigId)
    router.refresh()
  }

  return (
    <div className="card card-body space-y-4">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Review decision</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Approve the work to accept it — then you&apos;ll pay your worker directly on the
          next step. Or send it back for revision.
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
          Approve work
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
