'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ConfirmActionModal from '@/components/shared/ConfirmActionModal'

// ============================================================
// ReinstateApplicantButton
// ============================================================
// Shown on a past applicant (rejected/cancelled) once the gig is open
// again. Moves them back into the current applicants list so the
// flipper can pick them for this gig.
// ============================================================

interface Props {
  claimId: string
  workerName: string
}

export default function ReinstateApplicantButton({ claimId, workerName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/applicant/reinstate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      })
      const data = await res.json()
      if (res.ok && data.status === 'ok') {
        setOpen(false)
        router.refresh()
        return
      }
      setError(data?.error || 'Could not add this applicant back.')
    } catch (err: any) {
      setError(err?.message || 'Could not add this applicant back.')
    }
    setLoading(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add back to applicants
      </Button>
      {error && <p className="text-sm text-destructive w-full">{error}</p>}

      <ConfirmActionModal
        open={open}
        title="Add this applicant back?"
        description={`This moves ${workerName} back into your current applicants so you can pick them for this gig.`}
        confirmLabel="Add back"
        confirmVariant="accent"
        loading={loading}
        onCancel={() => {
          if (!loading) setOpen(false)
        }}
        onConfirm={handleConfirm}
      />
    </>
  )
}
