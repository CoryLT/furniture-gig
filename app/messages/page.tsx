import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageCircle, User } from 'lucide-react'
import Image from 'next/image'

interface ConvRow {
  id: string
  gig_id: string
  flipper_user_id: string
  worker_user_id: string
  last_message_at: string | null
  created_at: string
  gigs: { id: string; title: string; slug: string } | null
}

interface MsgRow {
  id: string
  conversation_id: string
  sender_user_id: string
  body: string
  read_at: string | null
  created_at: string
}

interface WorkerProfile {
  user_id: string
  first_name: string
  last_name: string
  username: string | null
  avatar_url: string
}

interface FlipperProfile {
  user_id: string
  business_name: string
  username: string | null
  avatar_url: string
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default async function MessagesInboxPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 1. Get all conversations where this user is a participant.
  // RLS filters automatically, but we keep the OR filter explicit for safety.
  const { data: conversationsData } = await supabase
    .from('gig_conversations')
    .select(`
      id,
      gig_id,
      flipper_user_id,
      worker_user_id,
      last_message_at,
      created_at,
      gigs ( id, title, slug )
    `)
    .or(`flipper_user_id.eq.${user.id},worker_user_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  const conversations = (conversationsData as ConvRow[] | null) ?? []
  const conversationIds = conversations.map((c) => c.id)

  // 2. Pull all messages for these conversations — we'll use them for previews + unread counts.
  // Capping at 500 latest messages overall to be safe.
  let messages: MsgRow[] = []
  if (conversationIds.length > 0) {
    const { data: messagesData } = await supabase
      .from('gig_messages')
      .select('id, conversation_id, sender_user_id, body, read_at, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(500)
    messages = (messagesData as MsgRow[] | null) ?? []
  }

  // Last message per conversation (messages already sorted desc, so first hit is latest)
  const lastByConv = new Map<string, MsgRow>()
  // Unread count: messages received by ME (not sent by me) with read_at = null
  const unreadByConv = new Map<string, number>()
  for (const m of messages) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m)
    if (m.sender_user_id !== user.id && m.read_at === null) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1)
    }
  }

  // 3. Gather all "other user" IDs so we can fetch their profiles in one shot.
  const otherUserIds = Array.from(
    new Set(
      conversations.map((c) =>
        c.flipper_user_id === user.id ? c.worker_user_id : c.flipper_user_id
      )
    )
  )

  let workerProfilesById = new Map<string, WorkerProfile>()
  let flipperProfilesById = new Map<string, FlipperProfile>()

  if (otherUserIds.length > 0) {
    const { data: workerProfiles } = await supabase
      .from('worker_profiles')
      .select('user_id, first_name, last_name, username, avatar_url')
      .in('user_id', otherUserIds)
    for (const wp of (workerProfiles as WorkerProfile[] | null) ?? []) {
      workerProfilesById.set(wp.user_id, wp)
    }

    const { data: flipperProfiles } = await supabase
      .from('flipper_profiles')
      .select('user_id, business_name, username, avatar_url')
      .in('user_id', otherUserIds)
    for (const fp of (flipperProfiles as FlipperProfile[] | null) ?? []) {
      flipperProfilesById.set(fp.user_id, fp)
    }
  }

  function getOtherInfo(c: ConvRow) {
    const otherId = c.flipper_user_id === user!.id ? c.worker_user_id : c.flipper_user_id
    const iAmWorker = c.worker_user_id === user!.id // so the OTHER side is the flipper
    const wp = workerProfilesById.get(otherId)
    const fp = flipperProfilesById.get(otherId)

    let name = 'User'
    let avatarUrl: string | null = null
    let username: string | null = null

    if (wp) {
      const full = `${wp.first_name} ${wp.last_name}`.trim()
      if (full) name = full
      if (wp.avatar_url) avatarUrl = wp.avatar_url
      if (wp.username) username = wp.username
    }
    // If the other side is the flipper, prefer business_name when set
    if (iAmWorker && fp) {
      if (fp.business_name && fp.business_name.trim()) name = fp.business_name
      if (fp.avatar_url) avatarUrl = fp.avatar_url
      if (fp.username) username = fp.username
    }

    return { name, avatarUrl, username }
  }

  const totalUnread = Array.from(unreadByConv.values()).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-accent" />
            Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalUnread > 0
              ? `You have ${totalUnread} unread message${totalUnread === 1 ? '' : 's'}.`
              : 'All caught up.'}
          </p>
        </div>
      </div>

      {/* List */}
      {conversations.length === 0 ? (
        <div className="border border-stone-200 bg-white rounded-lg p-12 text-center space-y-3">
          <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="font-medium text-foreground">No conversations yet</h2>
          <p className="text-sm text-muted-foreground">
            When you claim a gig, or someone claims one of yours, a chat will appear here.
          </p>
        </div>
      ) : (
        <div className="border border-stone-200 bg-white rounded-lg divide-y divide-stone-200 overflow-hidden">
          {conversations.map((c) => {
            const { name, avatarUrl, username: _username } = getOtherInfo(c)
            const last = lastByConv.get(c.id)
            const unread = unreadByConv.get(c.id) ?? 0
            const lastFromMe = last && last.sender_user_id === user!.id
            const preview = last
              ? `${lastFromMe ? 'You: ' : ''}${last.body}`
              : 'No messages yet'
            const when = timeAgo(c.last_message_at ?? c.created_at)
            const gigTitle = c.gigs?.title ?? 'Gig'

            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 p-4 hover:bg-stone-50 transition-colors"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {avatarUrl ? (
                    <div className="relative w-11 h-11 rounded-full overflow-hidden bg-stone-200">
                      <Image src={avatarUrl} alt={name} fill sizes="44px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-medium">
                      {(name
                        .split(' ')
                        .map((p) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()) || <User className="w-5 h-5" />}
                    </div>
                  )}
                </div>

                {/* Middle: name, gig, preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        About: {gigTitle}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs ${unread > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                        {when}
                      </span>
                      {unread > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm truncate mt-1 ${unread > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {preview}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
