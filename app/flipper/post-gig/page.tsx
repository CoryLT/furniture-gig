import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostGigForm, { type ExistingDraft } from './PostGigForm'

// This page is server-rendered so we can check for a flipper_profiles row
// BEFORE showing the form. If the user has never set up the flipper side,
// we walk them through it first, then bring them right back here.
//
// We also look for an in-progress DRAFT gig this user already started but
// never finished. If we find one we hand it to the form so it resumes on
// step 2 (photos) — that's how we recover when someone refreshes mid-flow.
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

  // Resume any in-progress draft this user started but never published.
  // We pick the most recent one — if there's somehow more than one draft
  // they can use "Start over" to delete it and begin fresh.
  const { data: draftRows } = await supabase
    .from('gigs')
    .select('id, title')
    .eq('poster_user_id', user.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)

  const existingDraft: ExistingDraft | null =
    draftRows && draftRows.length > 0
      ? { id: (draftRows[0] as { id: string }).id, title: (draftRows[0] as { title: string }).title }
      : null

  return <PostGigForm existingDraft={existingDraft} />
}
