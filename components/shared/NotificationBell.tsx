'use client'

// ============================================================
// NotificationBell — bell icon + unread count bubble + dropdown.
// ============================================================
// Lives in the Nav. Pulls notifications from Supabase directly
// (RLS scopes them to the current user). Subscribes to realtime
// INSERTs so a new follow shows up live.
//
// Designed to be generic: rendering of a single row is dispatched
// on `notification.type`. Add a new case to render different
// event types later (gig picked, paid, etc.).
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Bell, Loader2, User } from 'lucide-react'

interface NotificationRow {
  id: string
  recipient_user_id: string
  actor_user_id: string | null
  type: 'follow' | 'gig_application'
  data: Record<string, any>
  read_at: string | null
  created_at: string
}

interface ActorInfo {
  user_id: string
  username: string | null
  displayName: string
  avatarUrl: string
}

const MAX_ROWS = 15

export function NotificationBell() {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [actorById, setActorById] = useState<Map<string, ActorInfo>>(new Map())
  const [markingAll, setMarkingAll] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const currentUserIdRef = useRef<string | null>(null)

  // -------- Load + subscribe --------
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadAndSubscribe() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setLoading(false)
        return
      }
      currentUserIdRef.current = user.id

      // Pull the most recent notifications (RLS restricts to mine)
      const { data: rows } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_ROWS)

      const list = (rows as NotificationRow[] | null) ?? []
      if (!cancelled) setNotifications(list)

      // Hydrate actor info (avatar + name + username) for visible rows
      await hydrateActors(list)

      if (!cancelled) setLoading(false)

      // Realtime: new INSERTs into notifications for me
      channel = supabase
        .channel(`notif:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${user.id}`,
          },
          async (payload) => {
            const row = payload.new as NotificationRow
            setNotifications((prev) =>
              // Avoid dupes if we somehow reload + receive
              prev.some((p) => p.id === row.id)
                ? prev
                : [row, ...prev].slice(0, MAX_ROWS),
            )
            // Pull actor info for the new row
            await hydrateActors([row])
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as NotificationRow
            setNotifications((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            )
          },
        )
        .subscribe()
    }

    loadAndSubscribe()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------- Click outside to close --------
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // -------- Hydrate actor info --------
  // Looks up worker_profiles + flipper_profiles for any actor we don't
  // already have cached, then merges into actorById.
  async function hydrateActors(rows: NotificationRow[]) {
    const idsNeeded = Array.from(
      new Set(
        rows
          .map((r) => r.actor_user_id)
          .filter((id): id is string => !!id),
      ),
    ).filter((id) => !actorById.has(id))

    if (idsNeeded.length === 0) return

    const [workerRes, flipperRes] = await Promise.all([
      supabase
        .from('worker_profiles')
        .select('user_id, username, first_name, last_name, avatar_url')
        .in('user_id', idsNeeded),
      supabase
        .from('flipper_profiles')
        .select('user_id, username, avatar_url, business_name')
        .in('user_id', idsNeeded),
    ])

    const workers = (workerRes.data as any[]) || []
    const flippers = (flipperRes.data as any[]) || []
    const workerMap = new Map(workers.map((w) => [w.user_id, w]))
    const flipperMap = new Map(flippers.map((f) => [f.user_id, f]))

    setActorById((prev) => {
      const next = new Map(prev)
      for (const id of idsNeeded) {
        const w = workerMap.get(id)
        const f = flipperMap.get(id)
        const username = w?.username || f?.username || null
        const fullName =
          w && (w.first_name || w.last_name)
            ? `${w.first_name} ${w.last_name}`.trim()
            : ''
        const displayName =
          fullName || f?.business_name || (username ? `@${username}` : 'Someone')
        next.set(id, {
          user_id: id,
          username,
          displayName,
          avatarUrl: w?.avatar_url || f?.avatar_url || '',
        })
      }
      return next
    })
  }

  // -------- Helpers --------
  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markOneRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id && !n.read_at
          ? { ...n, read_at: new Date().toISOString() }
          : n,
      ),
    )
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch (err) {
      console.error('[NotificationBell] markOneRead error:', err)
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return
    setMarkingAll(true)
    // Optimistic
    const nowIso = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })),
    )
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch (err) {
      console.error('[NotificationBell] markAllRead error:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  // -------- Row rendering --------
  function renderRow(n: NotificationRow) {
    const actor = n.actor_user_id ? actorById.get(n.actor_user_id) : null
    const profileHref = actor?.username ? `/u/${actor.username}` : '/connections'
    // Per-type click target. Follow notifications go to the follower's
    // profile. Gig-application notifications go to the gig page where
    // the flipper reviews applicants. Add new cases here as the
    // notification types grow.
    let clickHref = profileHref
    if (n.type === 'gig_application' && n.data?.gig_id) {
      clickHref = `/flipper/gigs/${n.data.gig_id}`
    }
    const message = renderMessage(n, actor)
    const when = timeAgo(n.created_at)
    const initials = actor
      ? actor.displayName
          .split(' ')
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : ''

    return (
      <Link
        key={n.id}
        href={clickHref}
        onClick={() => {
          if (!n.read_at) markOneRead(n.id)
          setOpen(false)
        }}
        className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted ${
          !n.read_at ? 'bg-accent/10/40' : ''
        }`}
      >
        <div className="flex-shrink-0 mt-0.5">
          {actor?.avatarUrl ? (
            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-muted">
              <Image
                src={actor.avatarUrl}
                alt={actor.displayName}
                fill
                sizes="36px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-medium text-xs">
              {initials || <User className="w-4 h-4" />}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm ${
              !n.read_at ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {message}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{when}</p>
        </div>
        {!n.read_at && (
          <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-accent" />
        )}
      </Link>
    )
  }

  function renderMessage(n: NotificationRow, actor: ActorInfo | null) {
    const who = actor ? (
      <span className="font-medium text-foreground">{actor.displayName}</span>
    ) : (
      <span className="font-medium text-foreground">Someone</span>
    )

    switch (n.type) {
      case 'follow':
        return <>{who} followed you.</>
      case 'gig_application': {
        const title = n.data?.gig_title as string | undefined
        return (
          <>
            {who} applied to
            {title ? <span className="font-medium text-foreground"> {title}</span> : ' your gig'}
            .
          </>
        )
      }
      default:
        return <>{who} did something.</>
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0 || markingAll}
              className="text-xs text-muted-foreground hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {markingAll ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Working…
                </span>
              ) : (
                'Mark all read'
              )}
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-2">
                <Bell className="w-8 h-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  You're all caught up.
                </p>
                <p className="text-xs text-muted-foreground">
                  We'll let you know when something happens.
                </p>
              </div>
            ) : (
              notifications.map(renderRow)
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Time-ago helper (small, no dep)
// ============================================================
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(1, Math.floor((now - then) / 1000))
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString()
}
