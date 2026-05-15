import { createClient } from '@/lib/supabase/server'
import GigListingCard from '@/components/worker/GigListingCard'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function GigsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Load the worker's profile to get their city/state for filtering
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('city, state')
    .eq('user_id', user!.id)
    .single()

  const workerCity = workerProfile?.city?.trim() ?? ''
  const workerState = workerProfile?.state?.trim() ?? ''
  const hasLocation = workerCity.length > 0 && workerState.length > 0

  // Build gig query — filter by worker location if available
  let query = supabase
    .from('gigs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (hasLocation) {
    query = query
      .ilike('city', workerCity)
      .eq('state', workerState)
  }

  const { data: gigs } = await query

  // Load any claims this worker has so we can show "claimed by you" on cards
  const { data: myClaims } = await supabase
    .from('gig_claims')
    .select('gig_id')
    .eq('worker_user_id', user!.id)

  const myClaimedIds = new Set(myClaims?.map((c) => c.gig_id) ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Available Gigs</h1>
          <p className="text-muted-foreground mt-1">
            {hasLocation
              ? `${gigs?.length ?? 0} open ${gigs?.length === 1 ? 'gig' : 'gigs'} in ${workerCity}, ${workerState}`
              : `${gigs?.length ?? 0} open ${gigs?.length === 1 ? 'gig' : 'gigs'}`
            }
          </p>
        </div>
      </div>

      {/* No location set banner */}
      {!hasLocation && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Your profile doesn&apos;t have a city and state set yet, so you&apos;re seeing all gigs.{' '}
            <Link href="/auth/onboarding" className="underline font-medium">Update your profile</Link> to see only local gigs.
          </span>
        </div>
      )}

      {!gigs || gigs.length === 0 ? (
        <div className="card card-body text-center py-16 space-y-2">
          <p className="text-lg text-muted-foreground">No gigs available in your area right now.</p>
          <p className="text-sm text-muted-foreground">Check back soon — new projects get posted regularly.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((gig) => (
            <GigListingCard
              key={gig.id}
              gig={gig}
              isClaimed={myClaimedIds.has(gig.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
