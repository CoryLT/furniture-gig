'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare } from 'lucide-react'

// Live version of the dashboard's "unread messages" card. It counts the same
// thing the server did (unread incoming gig messages) but updates in real time
// and re-counts whenever you come back to the page — so it clears the moment a
// message is read, instead of staying frozen from when the page first loaded.
export default function UnreadMessagesCard() {
  const supabase = createClient()
  const [count, setCount] = useState(0)
  const userIdRef = useRef<string | null>(null)

  async function recount() {
    const userId = userIdRef.current
    if (!userId) return
    const { data: convs } = await supabase
      .from('gig_conversations')
      .select('id')
      .or(`flipper_user_id.eq.${userId},worker_user_id.eq.${userId}`)
    const convIds = (convs ?? []).map((c: any) => c.id)
    if (convIds.length === 0) {
      setCount(0)
      return
    }
    const { count: c } = await supabase
      .from('gig_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_user_id', userId)
      .is('read_at', null)
    setCount(c ?? 0)
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      userIdRef.current = user.id
      await recount()

      channel = supabase
        .channel('dashboard-unread')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'gig_messages' },
          () => recount()
        )
        .subscribe()
    })()

    // Re-count when the tab becomes visible again (e.g. coming back from a chat).
    function onVisible() {
      if (document.visibilityState === 'visible') recount()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (count <= 0) return null

  return (
    <Link
      href="/messages"
      className="card card-body space-y-3 block hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">
            {count} unread message{count === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground">Catch up on your conversations</p>
        </div>
      </div>
    </Link>
  )
}
