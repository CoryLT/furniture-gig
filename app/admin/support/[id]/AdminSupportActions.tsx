'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  conversationId: string
  currentStatus: 'active' | 'resolved' | 'escalated'
}

export default function AdminSupportActions({ conversationId, currentStatus }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(status: 'active' | 'resolved') {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/support/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, status }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to update')
      }
    } catch (e: any) {
      alert(e.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {currentStatus !== 'resolved' && (
        <Button
          variant="default"
          size="sm"
          onClick={() => setStatus('resolved')}
          disabled={busy}
        >
          Mark resolved
        </Button>
      )}
      {currentStatus === 'resolved' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatus('active')}
          disabled={busy}
        >
          Reopen
        </Button>
      )}
    </div>
  )
}
