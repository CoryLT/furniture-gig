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

  // Load ALL open gigs (we'll filter client-side by location)
  const { data: gigs } = await supabase
    .from('gigs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  // Load any claims this worker has
  const { data: myClaims } = await supabase
    .from('gig_claims')
    .select('gig_id')
    .eq('worker_user_id', user!.id)

  const myClaimedIds = new Set(myClaims?.map((c) => c.gig_id) ?? [])

  return (
    <GigFilterContent
      initialGigs={gigs ?? []}
      workerCity={workerCity}
      workerState={workerState}
      myClaimedIds={myClaimedIds}
      hasLocation={hasLocation}
    />
  )
}