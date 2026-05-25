import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PublicProfileClient } from '@/components/profile/PublicProfileClient'

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const supabase = createClient()
  const username = params.username.toLowerCase()

  // Pull from BOTH profile tables in parallel so we can show one unified view
  const [workerResult, flipperResult] = await Promise.all([
    supabase
      .from('worker_profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle(),
    supabase
      .from('flipper_profiles')
      .select('*')
      .eq('username', username)
      .eq('profile_public', true)
      .maybeSingle(),
  ])

  const worker = workerResult.data as any
  const flipper = flipperResult.data as any

  // If neither table has a row for this username, 404
  if (!worker && !flipper) {
    notFound()
  }

  // Pick a userId from whichever table has data
  const userId = worker?.user_id || flipper?.user_id

  // Merged profile data — prefer non-empty values across both tables
  const merged = {
    user_id: userId,
    username,
    fullName: worker?.full_name || '',
    avatarUrl: worker?.avatar_url || flipper?.avatar_url || '',
    city: worker?.city || flipper?.city || '',
    state: worker?.state || flipper?.state || '',
    businessName: flipper?.business_name || '',
    bio: flipper?.bio || worker?.bio || '',
    website: flipper?.website || '',
    skills: (worker?.skills as string[]) || [],
    isFoundingMember:
      worker?.founding_member === true || flipper?.founding_member === true,
  }

  // Pull their open gigs (as a poster) and completed count
  const [openGigsResult, completedCountResult] = userId
    ? await Promise.all([
        supabase
          .from('gigs')
          .select('*')
          .eq('poster_user_id', userId)
          .in('status', ['open'])
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('gigs')
          .select('*', { count: 'exact', head: true })
          .eq('poster_user_id', userId)
          .eq('status', 'completed'),
      ])
    : [{ data: [] }, { count: 0 }]

  const openGigs = openGigsResult.data || []
  const completedCount = (completedCountResult as any).count || 0

  // Pull photo galleries from BOTH worker and flipper tables, combine
  const [workerPhotosResult, flipperPhotosResult] = userId
    ? await Promise.all([
        supabase
          .from('worker_photo_galleries')
          .select('*')
          .eq('worker_user_id', userId)
          .order('display_order', { ascending: true }),
        supabase
          .from('flipper_photo_galleries')
          .select('*')
          .eq('flipper_user_id', userId)
          .order('display_order', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }]

  // Who is viewing this page? (null if logged out)
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()

  // Is the viewer already following this profile?
  let viewerIsFollowing = false
  if (viewer && userId && viewer.id !== userId) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_user_id', viewer.id)
      .eq('followed_user_id', userId)
      .maybeSingle()
    viewerIsFollowing = !!followRow
  }

  // If the viewer IS the profile owner, fetch their follower count.
  // Private: only the owner sees this number.
  let ownFollowerCount: number | null = null
  if (viewer && userId && viewer.id === userId) {
    const { data: countResult } = await supabase.rpc('follower_count', {
      target_user_id: userId,
    })
    ownFollowerCount = (countResult as number | null) ?? 0
  }

  return (
    <PublicProfileClient
      profile={merged}
      openGigs={openGigs}
      completedCount={completedCount}
      workerPhotos={workerPhotosResult.data || []}
      flipperPhotos={flipperPhotosResult.data || []}
      viewerUserId={viewer?.id || null}
      viewerIsFollowing={viewerIsFollowing}
      ownFollowerCount={ownFollowerCount}
    />
  )
}
