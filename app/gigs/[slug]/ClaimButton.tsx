'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { GigRow, GigClaimRow } from '@/types/database'

interface Props {
  gig: GigRow
  isClaimed: boolean
  isMyGig: boolean
  existingClaim: GigClaimRow | null
  userId: string
}

export default function ClaimButton({ gig, isClaimed, isMyGig, existingClaim, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Gig is closed to claims
  if (gig.status !== 'open') {
    if (isMyGig) {
      return (
        <div className="card card-body space-y-3">
          <p className="text-sm font-medium text-foreground">You have claimed this gig.</p>
          <Button
            variant="accent"
            onClick={() => router.push('/my-gigs')}
          >
            Go to My Gigs
          </Button>
        </div>
      )
    }
    return (
      <div className="card card-body">
        <p className="text-sm text-muted-foreground">This gig is no longer available to claim.</p>
      </div>
    )
  }

  // Already claimed by someone else
  if (isClaimed && !isMyGig) {
    return (
      <div className="card card-body">
        <p className="text-sm text-muted-foreground">This gig has already been claimed by another worker.</p>
      </div>
    )
  }

  // Worker already claimed this
  if (isMyGig) {
    return (
      <div className="card card-body space-y-3">
        <p className="text-sm font-medium text-foreground">✓ You have claimed this gig.</p>
        <Button variant="accent" onClick={() => router.push('/my-gigs')}>
          Go to My Gigs
        </Button>
      </div>
    )
  }

  // Available to claim
  async function handleClaim() {
    setLoading(true)
    setError('')

    // Insert claim — UNIQUE constraint on gig_id prevents double-claim at DB level
    const { error: claimError } = await supabase
      .from('gig_claims')
      .insert({
        gig_id: gig.id,
        worker_user_id: userId,
        status: 'active',
      })

    if (claimError) {
      if (claimError.code === '23505') {
        setError('Sorry, someone just claimed this gig before you.')
      } else {
        setError('Failed to claim gig. Please try again.')
      }
      setLoading(false)
      return
    }

    // Update gig status to claimed
    await supabase
      .from('gigs')
      .update({ status: 'claimed' })
      .eq('id', gig.id)

    router.push('/my-gigs')
    router.refresh()
  }

  return (
    <div className="card card-body space-y-3">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Ready to take this on?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Claiming is exclusive — once you claim it, no one else can. Make sure you can complete it before the due date.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button variant="accent" loading={loading} onClick={handleClaim} className="w-full sm:w-auto">
        Claim this gig
      </Button>
    </div>
  )
}
