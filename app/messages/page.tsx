import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageCircle } from 'lucide-react'
import ConversationRow from './ConversationRow'

// ----- Types -----

interface BaseConv {
  id: string
  other_user_id: string
  last_message_at: string | null
  created_at: string
  contextTitle: string
  contextHref: string | null
  contextLabel: string
}
interface GigConvRow extends BaseConv {
  kind: 'gig'
  flipper_user_id: string
  worker_user_id: string
}
interface ListingConvRow extends BaseConv {
  kind: 'listing'
  seller_user_id: string
  buyer_user_id: string
}
interface UserConvRow extends BaseConv {
  kind: 'user'
  user_a_id: string
  user_b_id: string
}
type ConvRow = GigConvRow | ListingConvRow | UserConvRow

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

interface StateRow {
  conversation_kind: 'gig' | 'listing' | 'user'
  conversation_id: string
  archived_at: string | null
  deleted_at: string | null
}

export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: { view?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const view = searchParams?.view === 'archived' ? 'archived' : 'inbox'

  // -------- Gig conversations --------
  const { data: gigConvsData } = await supabase
    .from('gig_conversations')
    .select(`
      id, flipper_user_id, worker_user_id, last_message_at, created_at,
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
      id, seller_user_id, buyer_user_id, last_message_at, created_at,
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
    .select('id, user_a_id, user_b_id, last_message_at, created_at')
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

  // -------- Merge + sort (newest first) --------
  let conversations: ConvRow[] = [...gigConvs, ...listingConvs, ...userConvs].sort(
    (a, b) => {
      const at = a.last_message_at ?? a.created_at
      const bt = b.last_message_at ?? b.created_at
      return bt.localeCompare(at)
    }
  )

  // -------- Messages for all three tables --------
  const gigConvIds = gigConvs.map((c) => c.id)
  const listingConvIds = listingConvs.map((c) => c.id)
  const userConvIds = userConvs.map((c) => c.id)

  async function loadMessages(table: string, ids: string[]) {
    if (ids.length === 0) return [] as MsgRow[]
    const { data } = await supabase
      .from(table)
      .select('id, conversation_id, sender_user_id, body, read_at, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(500)
    return (data as MsgRow[] | null) ?? []
  }

  const [gigMessages, listingMessages, userMessages] = await Promise.all([
    loadMessages('gig_messages', gigConvIds),
    loadMessages('listing_messages', listingConvIds),
    loadMessages('user_messages', userConvIds),
  ])

  const allMessages = [...gigMessages, ...listingMessages, ...userMessages]

  const lastByConv = new Map<string, MsgRow>()
  const unreadByConv = new Map<string, number>()
  for (const m of allMessages) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m)
    if (m.sender_user_id !== user.id && m.read_at === null) {
      unreadByConv.set(
        m.conversation_id,
        (unreadByConv.get(m.conversation_id) ?? 0) + 1
      )
    }
  }

  // -------- Per-user archive/delete state --------
  const { data: stateData } = await supabase
    .from('conversation_user_state')
    .select('conversation_kind, conversation_id, archived_at, deleted_at')
    .eq('user_id', user.id)

  const stateByConv = new Map<string, StateRow>()
  for (const s of (stateData as StateRow[] | null) ?? []) {
    stateByConv.set(s.conversation_id, s)
  }

  // Apply archive/delete filtering. "Deleted reappears on new message":
  // a conversation hidden by deleted_at comes back if its latest message
  // is newer than deleted_at.
  conversations = conversations.filter((c) => {
    const st = stateByConv.get(c.id)
    const lastAt = c.last_message_at ?? c.created_at

    // Deleted? Hidden unless a newer message arrived after deletion.
    if (st?.deleted_at) {
      if (lastAt && lastAt.localeCompare(st.deleted_at) > 0) {
        // Newer message — treat as restored, show in inbox view only
        return view === 'inbox'
      }
      return false
    }

    // Archived? Show only in archived view; otherwise show in inbox view.
    const isArchived = !!st?.archived_at
    if (view === 'archived') return isArchived
    return !isArchived
  })

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

    if (wp) {
      const full = (wp.full_name ?? '').trim()
      if (full) name = full
      if (wp.avatar_url) avatarUrl = wp.avatar_url
    }

    let preferBusinessName = false
    if (c.kind === 'gig') {
      preferBusinessName = c.worker_user_id === user!.id
    } else if (c.kind === 'user') {
      preferBusinessName = false
    } else {
      preferBusinessName = true
    }

    if (preferBusinessName && fp) {
      if (fp.business_name && fp.business_name.trim()) name = fp.business_name
      if (fp.avatar_url) avatarUrl = fp.avatar_url
    } else if (!wp && fp) {
      if (fp.business_name && fp.business_name.trim()) name = fp.business_name
      if (fp.avatar_url) avatarUrl = fp.avatar_url
    }

    return { name, avatarUrl }
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
            {view === 'archived'
              ? 'Archived conversations.'
              : totalUnread > 0
              ? `You have ${totalUnread} unread message${totalUnread === 1 ? '' : 's'}.`
              : 'All caught up.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/messages"
          className={`px-3 py-1.5 rounded-lg border transition-colors ${
            view === 'inbox'
              ? 'bg-accent text-accent-foreground border-accent'
              : 'bg-card border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Inbox
        </Link>
        <Link
          href="/messages?view=archived"
          className={`px-3 py-1.5 rounded-lg border transition-colors ${
            view === 'archived'
              ? 'bg-accent text-accent-foreground border-accent'
              : 'bg-card border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Archived
        </Link>
      </div>

      {/* List */}
      {conversations.length === 0 ? (
        <div className="border border-stone-200 bg-white rounded-lg p-12 text-center space-y-3">
          <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="font-medium text-foreground">
            {view === 'archived'
              ? 'No archived conversations'
              : 'No conversations yet'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {view === 'archived'
              ? 'Conversations you archive will show up here.'
              : 'Conversations appear here when you apply to a gig, get one claimed, message a seller, or contact someone from their profile.'}
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
            const when = timeAgoStr(c.last_message_at ?? c.created_at)
            const st = stateByConv.get(c.id)

            return (
              <ConversationRow
                key={c.id}
                conversationId={c.id}
                conversationKind={c.kind}
                href={`/messages/${c.id}`}
                name={name}
                avatarUrl={avatarUrl}
                contextLabel={c.contextLabel}
                contextTitle={c.contextTitle}
                preview={preview}
                when={when}
                unread={unread}
                isArchived={!!st?.archived_at}
                view={view}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function timeAgoStr(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
