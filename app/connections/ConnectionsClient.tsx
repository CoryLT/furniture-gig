'use client'

// ============================================================
// ConnectionsClient — list of people the viewer follows, with a
// search/filter box and a quick "Unfollow" action per row.
// ============================================================

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Users, Search, MapPin, User, Loader2 } from 'lucide-react'

export interface ConnectionRow {
  userId: string
  followedAt: string
  username: string
  displayName: string
  secondaryName: string
  avatarUrl: string
  city: string
  state: string
  bio: string
}

interface ConnectionsClientProps {
  connections: ConnectionRow[]
}

export function ConnectionsClient({ connections }: ConnectionsClientProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null)

  // Quick client-side filter. Matches name, username, or city/state.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return connections
    return connections.filter((c) => {
      const haystack = [
        c.displayName,
        c.secondaryName,
        c.username,
        c.city,
        c.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [connections, query])

  async function handleUnfollow(userId: string) {
    setUnfollowingId(userId)
    try {
      const res = await fetch('/api/follows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followed_user_id: userId }),
      })
      if (!res.ok) {
        let msg = 'Could not unfollow. Please try again.'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch {}
        alert(msg)
        return
      }
      // Refresh the server-rendered list so the row disappears
      router.refresh()
    } catch (err) {
      console.error('[ConnectionsClient] unfollow error:', err)
      alert('Network error. Please try again.')
    } finally {
      setUnfollowingId(null)
    }
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-accent" />
          My Connections
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          People you follow. Only you can see this list.
        </p>
      </div>

      {/* Empty state */}
      {connections.length === 0 ? (
        <div className="border border-stone-200 bg-white rounded-lg p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="font-medium text-foreground">No connections yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            When you find someone you want to keep track of, open their
            profile and tap <span className="font-medium text-foreground">Follow</span>.
            They'll show up here so you can reach back out later.
          </p>
          <div className="pt-2">
            <Link
              href="/gigs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Browse gigs
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, @username, or city"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            {filtered.length === connections.length
              ? `${connections.length} ${connections.length === 1 ? 'person' : 'people'}`
              : `${filtered.length} of ${connections.length} shown`}
          </p>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="border border-stone-200 bg-white rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No matches for "{query}".
              </p>
            </div>
          ) : (
            <div className="border border-stone-200 bg-white rounded-lg divide-y divide-stone-200 overflow-hidden">
              {filtered.map((c) => {
                const locText = [c.city, c.state].filter(Boolean).join(', ')
                const isBusy = unfollowingId === c.userId

                return (
                  <div
                    key={c.userId}
                    className="flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors"
                  >
                    {/* Avatar (links to profile) */}
                    <Link
                      href={`/u/${c.username}`}
                      className="flex-shrink-0"
                      aria-label={`Open ${c.displayName}'s profile`}
                    >
                      {c.avatarUrl ? (
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-stone-200">
                          <Image
                            src={c.avatarUrl}
                            alt={c.displayName}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-medium">
                          {initials(c.displayName) || (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                      )}
                    </Link>

                    {/* Middle — name, username, location, bio (links to profile) */}
                    <Link
                      href={`/u/${c.username}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="font-medium text-foreground truncate">
                        {c.displayName}
                      </p>
                      {c.secondaryName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.secondaryName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        @{c.username}
                        {locText && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {locText}
                            </span>
                          </>
                        )}
                      </p>
                      {c.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {c.bio}
                        </p>
                      )}
                    </Link>

                    {/* Unfollow */}
                    <button
                      type="button"
                      onClick={() => handleUnfollow(c.userId)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Removing…
                        </>
                      ) : (
                        'Unfollow'
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
