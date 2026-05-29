'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ConfirmActionModal from '@/components/shared/ConfirmActionModal'

// ============================================================
// CancelPickButton
// ============================================================
// Shown on the picked worker when they no-show. Cancels their claim,
// releases the held payment (no capture has happened yet, so the
// flipper is charged nothing), and reopens the gig so it can be
// offered to someone else.
// ============================================================

interface Props {
  claimId: string
  workerName: string
}

export default function CancelPickButton({ claimId, workerName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/cancel-pick', {
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
      setError(data?.error || 'Could not cancel this worker.')
    } catch (err: any) {
      setError(err?.message || 'Could not cancel this worker.')
    }
    setLoading(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancel — no-show
      </Button>
      {error && <p className="text-sm text-destructive w-full">{error}</p>}

      <ConfirmActionModal
        open={open}
        title="Cancel this worker?"
        description={`This marks ${workerName} as a no-show, releases the payment hold on your card (you won't be charged), and reopens the gig so you can offer it to someone else.`}
        confirmLabel="Cancel worker & reopen"
        confirmVariant="destructive"
        loading={loading}
        onCancel={() => {
          if (!loading) setOpen(false)
        }}
        onConfirm={handleConfirm}
      />
    </>
  )
}
