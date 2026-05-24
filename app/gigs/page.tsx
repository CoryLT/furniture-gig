import { createClient } from '@/lib/supabase/server'
import GigFilterContent from '@/components/worker/GigFilterContent'

export default async function GigsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Load the worker's profile to get their city/state
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('city, state')
    .eq('user_id', user!.id)
    .single()

  const workerCity = workerProfile?.city?.trim() ?? null
  const workerState = workerProfile?.state?.trim() ?? null
  const hasLocation = !!(workerCity && workerState)

  // Load ALL open gigs (we'll filter client-side by location).
  // Cory's own gigs are INCLUDED on purpose — he wants to see what workers see.
  // The card flags them with a "Your post" badge, and the gig detail page
  // already prevents him from claiming his own gig.
  const { data: gigs } = await supabase
    .from('gigs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const filteredGigs = gigs ?? []

  // Load any active applications/claims this worker has (exclude rejected/cancelled)
  const { data: myClaims } = await supabase
    .from('gig_claims')
    .select('gig_id, status')
    .eq('worker_user_id', user!.id)
    .in('status', ['pending', 'active', 'submitted_for_review', 'approved'])

  const myClaimedIds = new Set(myClaims?.map((c) => c.gig_id) ?? [])

  return (
    <GigFilterContent
      initialGigs={filteredGigs}
      workerCity={workerCity}
      workerState={workerState}
      myClaimedIds={myClaimedIds}
      hasLocation={hasLocation}
      currentUserId={user!.id}
    />
  )
}