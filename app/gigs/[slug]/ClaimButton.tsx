'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { GigRow, GigClaimRow } from '@/types/database'

interface Props {
  gig: GigRow
  myClaim: GigClaimRow | null
  isMyGig: boolean
  isOwnPostedGig: boolean
  hasActiveClaim: boolean
  pendingApplicantCount: number
  userId: string
  stripeReady: boolean
  stripeStarted: boolean
}

export default function ClaimButton({
  gig,
  myClaim,
  isMyGig,
  isOwnPostedGig,
  hasActiveClaim,
  pendingApplicantCount,
  userId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // The viewer posted this gig — they can't apply to their own gig
  if (isOwnPostedGig) {
    return (
      <div className="card card-body space-y-3">
        <p className="text-sm font-medium text-foreground">You posted this gig.</p>
        <p className="text-sm text-muted-foreground">
          You can&apos;t apply to your own gig. Manage applicants from your dashboard.
        </p>
        <Button variant="accent" onClick={() => router.push(`/flipper/gigs/${gig.id}`)}>
          Go to gig dashboard
        </Button>
      </div>
    )
  }

  // Viewer is the approved worker for this gig
  if (isMyGig) {
    return (
      <div className="card card-body space-y-3">
        <p className="text-sm font-medium text-foreground">✓ You were picked for this gig.</p>
        <Button variant="accent" onClick={() => router.push('/my-gigs')}>
          Go to My Gigs
        </Button>
      </div>
    )
  }

  // Viewer already applied — show status
  if (myClaim) {
    if (myClaim.status === 'pending') {
      return (
        <div className="card card-body space-y-3">
          <p className="text-sm font-medium text-foreground">⏳ Your application is pending.</p>
          <p className="text-sm text-muted-foreground">
            The flipper will review applicants and pick someone. You&apos;ll be notified either way.
          </p>
          <Button variant="outline" onClick={() => router.push('/my-gigs?tab=applications')}>
            See My Applications
          </Button>
        </div>
      )
    }
    if (myClaim.status === 'rejected') {
      return (
        <div className="card card-body">
          <p className="text-sm text-muted-foreground">
            This gig was assigned to another worker. Thanks for applying!
          </p>
        </div>
      )
    }
    if (myClaim.status === 'cancelled') {
      return (
        <div className="card card-body">
          <p className="text-sm text-muted-foreground">You cancelled your application to this gig.</p>
        </div>
      )
    }
  }

  // Gig is no longer open to applications
  if (gig.status !== 'open' || hasActiveClaim) {
    return (
      <div className="card card-body">
        <p className="text-sm text-muted-foreground">
          This gig is no longer accepting applications.
        </p>
      </div>
    )
  }

  // Stripe pre-apply gate removed — workers no longer need a payment-processor
  // account to apply. They add a pay handle (Cash App/Venmo/etc.) to their
  // profile and get paid directly. (FlipWork is moving off Stripe.)

  // Available — show Apply button
  async function handleApply() {
    setLoading(true)
    setError('')

    const { error: applyError } = await supabase.from('gig_claims').insert({
      gig_id: gig.id,
      worker_user_id: userId,
      status: 'pending',
    })

    if (applyError) {
      if (applyError.code === '23505') {
        setError('You have already applied to this gig.')
      } else if (/cannot claim a gig you posted/i.test(applyError.message ?? '')) {
        setError('You cannot apply to a gig you posted.')
      } else {
        setError('Could not submit your application. Please try again.')
      }
      setLoading(false)
      return
    }

    router.push('/my-gigs?tab=applications')
    router.refresh()
  }

  return (
    <div className="card card-body space-y-3">
      <div>
        <h3 className="font-sans font-semibold text-foreground">Interested in this gig?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Apply and the flipper will review applicants before picking someone. You can message the
          flipper directly as soon as you apply.
        </p>
        {pendingApplicantCount > 0 && (
          <p className="text-xs font-mono text-muted-foreground mt-2">
            {pendingApplicantCount} {pendingApplicantCount === 1 ? 'worker has' : 'workers have'} applied
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button variant="accent" loading={loading} onClick={handleApply} className="w-full sm:w-auto">
        Apply for this gig
      </Button>
    </div>
  )
}
