'use client'

// ============================================================
// FollowButton — toggles a follow/unfollow on a public profile.
// ============================================================
// Renders nothing if the viewer is logged-out or is viewing their
// own profile (parent should also gate, but we double-check here).
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, UserCheck } from 'lucide-react'

interface FollowButtonProps {
  followedUserId: string
  /** Initial state from the server — whether the viewer already follows this user */
  initialFollowing: boolean
  /** Hide entirely when true (logged-out or own profile) */
  hidden?: boolean
}

export function FollowButton({
  followedUserId,
  initialFollowing,
  hidden,
}: FollowButtonProps) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hidden) return null

  async function toggle() {
    setLoading(true)
    setError(null)

    const method = following ? 'DELETE' : 'POST'
    try {
      const res = await fetch('/api/follows', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followed_user_id: followedUserId }),
      })

      let data: any = null
      try {
        data = await res.json()
      } catch {
        // ignore parse errors — we still have res.ok
      }

      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.')
        return
      }

      setFollowing(!following)
      // Refresh server-rendered counts (e.g. follower count on own profile)
      router.refresh()
    } catch (err) {
      console.error('[FollowButton] toggle error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={
          following
            ? 'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors disabled:opacity-50'
            : 'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors disabled:opacity-50'
        }
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : following ? (
          <UserCheck className="w-4 h-4" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        {following ? 'Following' : 'Follow'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
