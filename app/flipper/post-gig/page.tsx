import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostGigForm from './PostGigForm'

// This page is server-rendered so we can check for a flipper_profiles row
// BEFORE showing the form. If the user has never set up the flipper side,
// we walk them through it first, then bring them right back here.
export default async function PostGigPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Do they already have a flipper profile?
  const { data: flipperProfile } = await supabase
    .from('flipper_profiles')
    .select('user_id, onboarding_complete')
    .eq('user_id', user.id)
    .single()

  // No profile, or profile exists but onboarding not finished?
  // Send them to flipper onboarding, and tell it to come back here when done.
  if (!flipperProfile || flipperProfile.onboarding_complete !== true) {
    redirect('/auth/flipper-onboarding?next=/flipper/post-gig')
  }

  return <PostGigForm />
}
