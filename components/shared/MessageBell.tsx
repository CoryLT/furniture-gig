'use client'

// ============================================================
// MessageBell — envelope icon + unread count + dropdown.
// ============================================================
// Lives in the Nav next to the NotificationBell. Lists the
// conversations that have unread incoming messages, newest first,
// each showing the other person's name and a short preview. Tapping
// a row opens that chat (which marks it read on mount, clearing it).
//
// Covers gig_conversations + listing_conversations, matching the
// unread count the rest of the nav already tracks. Subscribes to
// realtime INSERT/UPDATE on both message tables so the badge and
// list stay live.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, MessageCircle } from 'lucide-react'

interface UnreadConversation {
  conversationId: string
  otherName: string
  preview: string
  lastAt: string
}

const MAX_ROWS = 15

export function MessageBell() {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<UnreadConversation[]>([])

  const wrapRef = useRef<HTMLDivElement>(null)
  const currentUserIdRef = useRef<string | null>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build the list of unread conversations.
  async function loadUnread() {
    const userId = currentUserIdRef.current
    if (!userId) return

    // Which conversations is this user part of?
    const { data: gigConvs } = await supabase
      .from('gig_conversations')
      .select('id, flipper_user_id, worker_user_id')
      .or(`flipper_user_id.eq.${userId},worker_user_id.eq.${userId}`)

    const { data: listingConvs } = await supabase
      .from('listing_conversations')
      .select('id, seller_user_id, buyer_user_id')
      .or(`seller_user_id.eq.${userId},buyer_user_id.eq.${userId}`)

    // Map conversationId -> the other person's user id
    const otherByConv = new Map<string, string>()
    for (const c of gigConvs ?? []) {
      const row = c as { id: string; flipper_user_id: string; worker_user_id: string }
      otherByConv.set(
        row.id,
        row.flipper_user_id === userId ? row.worker_user_id : row.flipper_user_id
      )
    }
    for (const c of listingConvs ?? []) {
      const row = c as { id: string; seller_user_id: string; buyer_user_id: string }
      otherByConv.set(
        row.id,
        row.seller_user_id === userId ? row.buyer_user_id : row.seller_user_id
      )
    }

    const gigConvIds = (gigConvs ?? []).map((c: { id: string }) => c.id)
    const listingConvIds = (listingConvs ?? []).map((c: { id: string }) => c.id)

    // Pull unread incoming messages from both tables
    type Msg = {
      conversation_id: string
      sender_user_id: string
      body: string
      created_at: string
    }
    const unread: Msg[] = []

    if (gigConvIds.length > 0) {
      const { data } = await supabase
        .from('gig_messages')
        .select('conversation_id, sender_user_id, body, created_at')
        .in('conversation_id', gigConvIds)
        .neq('sender_user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
      for (const m of data ?? []) unread.push(m as Msg)
    }
    if (listingConvIds.length > 0) {
      const { data } = await supabase
        .from('listing_messages')
        .select('conversation_id, sender_user_id, body, created_at')
        .in('conversation_id', listingConvIds)
        .neq('sender_user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
      for (const m of data ?? []) unread.push(m as Msg)
    }

    // Keep only the newest unread message per conversation
    const latestByConv = new Map<string, Msg>()
    for (const m of unread) {
      const existing = latestByConv.get(m.conversation_id)
      if (!existing || m.created_at > existing.created_at) {
        latestByConv.set(m.conversation_id, m)
      }
    }

    // Resolve sender names (the "other" person in each conversation)
    const otherIds = Array.from(
      new Set(Array.from(latestByConv.keys()).map((cid) => otherByConv.get(cid)).filter(Boolean) as string[])
    )

    const nameById = new Map<string, string>()
    if (otherIds.length > 0) {
      const { data: workers } = await supabase
        .from('worker_profiles')
        .select('user_id, first_name, last_name, username')
        .in('user_id', otherIds)
      for (const w of workers ?? []) {
        const row = w as { user_id: string; first_name: string | null; last_name: string | null; username: string | null }
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
        nameById.set(row.user_id, name || row.username || 'Someone')
      }
      const missing = otherIds.filter((id) => !nameById.has(id))
      if (missing.length > 0) {
        const { data: flippers } = await supabase
          .from('flipper_profiles')
          .select('user_id, business_name, username')
          .in('user_id', missing)
        for (const f of flippers ?? []) {
          const row = f as { user_id: string; business_name: string | null; username: string | null }
          nameById.set(row.user_id, row.business_name || row.username || 'Someone')
        }
      }
    }

    const rows: UnreadConversation[] = Array.from(latestByConv.entries())
      .map(([conversationId, m]) => {
        const otherId = otherByConv.get(conversationId)
        return {
          conversationId,
          otherName: (otherId && nameById.get(otherId)) || 'Someone',
          preview: m.body.length > 80 ? m.body.slice(0, 80) + '…' : m.body,
          lastAt: m.created_at,
        }
      })
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
      .slice(0, MAX_ROWS)

    setItems(rows)
    setLoading(false)
  }

  // Initial load + realtime subscriptions
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      currentUserIdRef.current = user.id

      await loadUnread()

      channel = supabase.channel(`message-bell:${user.id}`)
      const reload = () => {
        loadUnread()
      }
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gig_messages' }, reload)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gig_messages' }, reload)
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listing_messages' }, reload)
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listing_messages' }, reload)
      channel.subscribe()
    }

    init()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unreadCount = items.length

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-600"
        aria-label="Messages"
      >
        <Mail className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-stone-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200">
            <h3 className="text-sm font-semibold text-foreground">Messages</h3>
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-accent transition-colors"
            >
              See all
            </Link>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-stone-100">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-2">
                <MessageCircle className="w-8 h-8 mx-auto text-stone-300" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">No new messages.</p>
                <p className="text-xs text-muted-foreground">
                  You're all caught up.
                </p>
              </div>
            ) : (
              items.map((it) => (
                <Link
                  key={it.conversationId}
                  href={`/messages/${it.conversationId}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {it.otherName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {it.preview}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {timeAgo(it.lastAt)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-accent" />
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Small time-ago helper (no dependency)
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
