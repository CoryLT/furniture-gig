'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface Props {
  claimId: string
  workerName: string
}

export default function ApplicantActions({ claimId, workerName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function handleApprove() {
    if (!confirm(`Pick ${workerName} for this gig? Everyone else who applied will be rejected.`)) {
      return
    }
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
    </div>
  )
}
