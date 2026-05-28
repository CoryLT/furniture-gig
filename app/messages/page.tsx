import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageCircle, User } from 'lucide-react'
import Image from 'next/image'

// ----- Types -----

interface GigConvRow {
  id: string
  kind: 'gig'
  flipper_user_id: string
  worker_user_id: string
  other_user_id: string
  last_message_at: string | null
  created_at: string
  contextTitle: string
  contextHref: string | null
  contextLabel: string
}

interface ListingConvRow {
  id: string
  kind: 'listing'
  seller_user_id: string
  buyer_user_id: string
  other_user_id: string
  last_message_at: string | null
  created_at: string
  contextTitle: string
  contextHref: string | null
  contextLabel: string
}

type ConvRow = GigConvRow | ListingConvRow | UserConvRow

interface UserConvRow {
  id: string
  kind: 'user'
  user_a_id: string
  user_b_id: string
  other_user_id: string
  last_message_at: string | null
  created_at: string
  contextLabel: string
  contextTitle: string
  contextHref: string | null
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
  full_name: string
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

  // -------- Gig conversations --------
  const { data: gigConvsData } = await supabase
    .from('gig_conversations')
    .select(`
      id,
      flipper_user_id,
      worker_user_id,
      last_message_at,
      created_at,
      gigs ( id, title, slug )
    `)
    .or(`flipper_user_id.eq.${user.id},worker_user_id.eq.${user.id}`)

  const gigConvsRaw =
    (gigConvsData as Array<{
      id: string
      flipper_user_id: string
      worker_user_id: string
      last_message_at: string | null
      created_at: string
      gigs: { id: string; title: string; slug: string } | null
    }> | null) ?? []

  const gigConvs: GigConvRow[] = gigConvsRaw.map((c) => ({
    id: c.id,
    kind: 'gig',
    flipper_user_id: c.flipper_user_id,
    worker_user_id: c.worker_user_id,
    other_user_id:
      c.flipper_user_id === user.id ? c.worker_user_id : c.flipper_user_id,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    contextLabel: 'About gig',
    contextTitle: c.gigs?.title ?? 'Gig',
    contextHref: c.gigs?.slug ? `/gigs/${c.gigs.slug}` : null,
  }))

  // -------- Listing conversations --------
  const { data: listingConvsData } = await supabase
    .from('listing_conversations')
    .select(`
      id,
      seller_user_id,
      buyer_user_id,
      last_message_at,
      created_at,
      marketplace_listings ( id, title, slug )
    `)
    .or(`seller_user_id.eq.${user.id},buyer_user_id.eq.${user.id}`)

  const listingConvsRaw =
    (listingConvsData as Array<{
      id: string
      seller_user_id: string
      buyer_user_id: string
      last_message_at: string | null
      created_at: string
      marketplace_listings: { id: string; title: string; slug: string } | null
    }> | null) ?? []

  const listingConvs: ListingConvRow[] = listingConvsRaw.map((c) => ({
    id: c.id,
    kind: 'listing',
    seller_user_id: c.seller_user_id,
    buyer_user_id: c.buyer_user_id,
    other_user_id:
      c.seller_user_id === user.id ? c.buyer_user_id : c.seller_user_id,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    contextLabel: 'About listing',
    contextTitle: c.marketplace_listings?.title ?? 'Listing',
    contextHref: c.marketplace_listings?.slug
      ? `/marketplace/${c.marketplace_listings.slug}`
      : null,
  }))

  // -------- User-to-user conversations --------
  const { data: userConvsData } = await supabase
    .from('user_conversations')
    .select(`
      id,
      user_a_id,
      user_b_id,
      last_message_at,
      created_at
    `)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

  const userConvsRaw =
    (userConvsData as Array<{
      id: string
      user_a_id: string
      user_b_id: string
      last_message_at: string | null
      created_at: string
    }> | null) ?? []

  const userConvs: UserConvRow[] = userConvsRaw.map((c) => ({
    id: c.id,
    kind: 'user',
    user_a_id: c.user_a_id,
    user_b_id: c.user_b_id,
    other_user_id: c.user_a_id === user.id ? c.user_b_id : c.user_a_id,
    last_message_at: c.last_message_at,
    created_at: c.created_at,
    contextLabel: 'Direct message',
    contextTitle: '',
    contextHref: null,
  }))

  // -------- Merge + sort --------
  const conversations: ConvRow[] = [...gigConvs, ...listingConvs, ...userConvs].sort((a, b) => {
    const at = a.last_message_at ?? a.created_at
    const bt = b.last_message_at ?? b.created_at
    return bt.localeCompare(at)
  })

  // -------- Pull messages for both tables --------
  const gigConvIds = gigConvs.map((c) => c.id)
  const listingConvIds = listingConvs.map((c) => c.id)

  let gigMessages: MsgRow[] = []
  if (gigConvIds.length > 0) {
    const { data: m } = await supabase
      .from('gig_messages')
      .select('id, conversation_id, sender_user_id, body, read_at, created_at')
      .in('conversation_id', gigConvIds)
      .order('created_at', { ascending: false })
      .limit(500)
    gigMessages = (m as MsgRow[] | null) ?? []
  }

  let listingMessages: MsgRow[] = []
  if (listingConvIds.length > 0) {
    const { data: m } = await supabase
      .from('listing_messages')
      .select('id, conversation_id, sender_user_id, body, read_at, created_at')
      .in('conversation_id', listingConvIds)
      .order('created_at', { ascending: false })
      .limit(500)
    listingMessages = (m as MsgRow[] | null) ?? []
  }

  const userConvIds = userConvs.map((c) => c.id)
  let userMessages: MsgRow[] = []
  if (userConvIds.length > 0) {
    const { data: m } = await supabase
      .from('user_messages')
      .select('id, conversation_id, sender_user_id, body, read_at, created_at')
      .in('conversation_id', userConvIds)
      .order('created_at', { ascending: false })
      .limit(500)
    userMessages = (m as MsgRow[] | null) ?? []
  }

  const allMessages = [...gigMessages, ...listingMessages, ...userMessages]

  // Last message per conversation (messages already sorted desc, so first hit is latest)
  const lastByConv = new Map<string, MsgRow>()
  // Unread count: messages received by ME (not sent by me) with read_at = null
  const unreadByConv = new Map<string, number>()
  for (const m of allMessages) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m)
    if (m.sender_user_id !== user.id && m.read_at === null) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1)
    }
  }

  // -------- Other-user profiles --------
  const otherUserIds = Array.from(
    new Set(conversations.map((c) => c.other_user_id))
  )

  const workerProfilesById = new Map<string, WorkerProfile>()
  const flipperProfilesById = new Map<string, FlipperProfile>()

  if (otherUserIds.length > 0) {
    const { data: workerProfiles } = await supabase
      .from('worker_profiles')
      .select('user_id, full_name, username, avatar_url')
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
    const wp = workerProfilesById.get(c.other_user_id)
    const fp = flipperProfilesById.get(c.other_user_id)

    let name = 'User'
    let avatarUrl: string | null = null
    let username: string | null = null

    if (wp) {
      const full = (wp.full_name ?? '').trim()
      if (full) name = full
      if (wp.avatar_url) avatarUrl = wp.avatar_url
      if (wp.username) username = wp.username
    }

    // For gig convs: if the OTHER side is the flipper, prefer business_name.
    // For listing convs: prefer business_name if it's set (whether the other
    //   side is buyer or seller — either may have a flipper profile).
    let preferBusinessName = false
    if (c.kind === 'gig') {
      preferBusinessName = c.worker_user_id === user!.id
    } else if (c.kind === 'user') {
      // Direct message: just use the person's name, no business override
      preferBusinessName = false
    } else {
      // listing conv: prefer business_name if available
      preferBusinessName = true
    }

    if (preferBusinessName && fp) {
      if (fp.business_name && fp.business_name.trim()) name = fp.business_name
      if (fp.avatar_url) avatarUrl = fp.avatar_url
      if (fp.username) username = fp.username
    } else if (!wp && fp) {
      // No worker profile, use flipper as fallback
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
            Conversations appear here when you apply to a gig, get one
            claimed, or message a seller about a marketplace listing.
          </p>
        </div>
      ) : (
        <div className="border border-stone-200 bg-white rounded-lg divide-y divide-stone-200 overflow-hidden">
          {conversations.map((c) => {
            const { name, avatarUrl } = getOtherInfo(c)
            const last = lastByConv.get(c.id)
            const unread = unreadByConv.get(c.id) ?? 0
            const lastFromMe = last && last.sender_user_id === user!.id
            const preview = last
              ? `${lastFromMe ? 'You: ' : ''}${last.body}`
              : 'No messages yet'
            const when = timeAgo(c.last_message_at ?? c.created_at)

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

                {/* Middle: name, context, preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.contextTitle
                          ? `${c.contextLabel}: ${c.contextTitle}`
                          : c.contextLabel}
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
