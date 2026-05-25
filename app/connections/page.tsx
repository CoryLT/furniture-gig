// ============================================================
// /connections — "My Connections" / address book
// ============================================================
// Shows everyone the current user follows. Private to the viewer.
// RLS on the follows table makes sure they can only see their own
// follow rows, but we also gate by follower_user_id explicitly.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConnectionsClient, type ConnectionRow } from './ConnectionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ConnectionsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 1) Pull all follow rows where I'm the follower, newest first
  const { data: followRows } = await supabase
    .from('follows')
    .select('id, followed_user_id, created_at')
    .eq('follower_user_id', user.id)
    .order('created_at', { ascending: false })

  const followed = (followRows as
    | { id: string; followed_user_id: string; created_at: string }[]
    | null) ?? []

  if (followed.length === 0) {
    return <ConnectionsClient connections={[]} />
  }

  const followedIds = followed.map((f) => f.followed_user_id)

  // 2) Pull worker + flipper profile rows for those ids in parallel
  const [workerResult, flipperResult] = await Promise.all([
    supabase
      .from('worker_profiles')
      .select(
        'user_id, username, first_name, last_name, avatar_url, city, state, bio'
      )
      .in('user_id', followedIds),
    supabase
      .from('flipper_profiles')
      .select(
        'user_id, username, avatar_url, city, state, business_name, bio, profile_public'
      )
      .in('user_id', followedIds),
  ])

  const workers =
    (workerResult.data as
      | {
          user_id: string
          username: string | null
          first_name: string
          last_name: string
          avatar_url: string | null
          city: string
          state: string
          bio: string | null
        }[]
      | null) ?? []
  const flippers =
    (flipperResult.data as
      | {
          user_id: string
          username: string | null
          avatar_url: string | null
          city: string
          state: string
          business_name: string
          bio: string | null
          profile_public: boolean
        }[]
      | null) ?? []

  const workerById = new Map(workers.map((w) => [w.user_id, w]))
  const flipperById = new Map(flippers.map((f) => [f.user_id, f]))

  // 3) Merge into one row per followed user, in follow-order
  const connections: ConnectionRow[] = followed
    .map((f) => {
      const w = workerById.get(f.followed_user_id)
      const fl = flipperById.get(f.followed_user_id)

      // Pick a username. Prefer worker, fall back to flipper.
      const username = w?.username || fl?.username || null

      // Skip ghosts (deleted profile, no username anywhere). Shouldn't
      // happen often since the user FK cascades, but be safe.
      if (!username) return null

      // Pick a display name.
      const fullName =
        w && (w.first_name || w.last_name)
          ? `${w.first_name} ${w.last_name}`.trim()
          : ''
      const displayName =
        fullName || fl?.business_name || `@${username}`

      return {
        userId: f.followed_user_id,
        followedAt: f.created_at,
        username,
        displayName,
        secondaryName:
          fl?.business_name && fullName && fl.business_name !== fullName
            ? fl.business_name
            : '',
        avatarUrl: w?.avatar_url || fl?.avatar_url || '',
        city: w?.city || fl?.city || '',
        state: w?.state || fl?.state || '',
        bio: (fl?.bio || w?.bio || '').slice(0, 140),
      } satisfies ConnectionRow
    })
    .filter((r): r is ConnectionRow => r !== null)

  return <ConnectionsClient connections={connections} />
}
