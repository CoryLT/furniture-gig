import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import ChatClient from './ChatClient'

interface Props {
  params: { conversationId: string }
}

// Renders the chat for a SINGLE conversation, which can be either:
//  - a gig conversation (gig_conversations + gig_messages), or
//  - a listing conversation (listing_conversations + listing_messages).
//
// We look up the ID in both tables and dispatch.
export default async function ConversationPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // --- 1) Try gig conversation first ---
  const { data: gigConv } = await supabase
    .from('gig_conversations')
    .select(`
      id,
      gig_id,
      flipper_user_id,
      worker_user_id,
      created_at,
      gigs (
        id,
        title,
        slug
      )
    `)
    .eq('id', params.conversationId)
    .maybeSingle<{
      id: string
      gig_id: string
      flipper_user_id: string
      worker_user_id: string
      created_at: string
      gigs: { id: string; title: string; slug: string } | null
    }>()

  if (gigConv) {
    return renderGigConversation({ supabase, user, conversation: gigConv })
  }

  // --- 2) Otherwise, try listing conversation ---
  const { data: listingConv } = await supabase
    .from('listing_conversations')
    .select(`
      id,
      listing_id,
      seller_user_id,
      buyer_user_id,
      created_at
    `)
    .eq('id', params.conversationId)
    .maybeSingle<{
      id: string
      listing_id: string
      seller_user_id: string
      buyer_user_id: string
      created_at: string
    }>()

  if (listingConv) {
    return renderListingConversation({
      supabase,
      user,
      conversation: listingConv,
    })
  }

  // --- 3) Otherwise, try user-to-user conversation ---
  const { data: userConv } = await supabase
    .from('user_conversations')
    .select('id, user_a_id, user_b_id, created_at')
    .eq('id', params.conversationId)
    .maybeSingle<{
      id: string
      user_a_id: string
      user_b_id: string
      created_at: string
    }>()

  if (userConv) {
    return renderUserConversation({ supabase, user, conversation: userConv })
  }

  notFound()
}

// ----- GIG conversation -----
async function renderGigConversation({
  supabase,
  user,
  conversation,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  user: { id: string }
  conversation: {
    id: string
    gig_id: string
    flipper_user_id: string
    worker_user_id: string
    created_at: string
    gigs: { id: string; title: string; slug: string } | null
  }
}) {
  const isFlipper = conversation.flipper_user_id === user.id
  const isWorker = conversation.worker_user_id === user.id
  if (!isFlipper && !isWorker) notFound()

  const otherUserId = isFlipper
    ? conversation.worker_user_id
    : conversation.flipper_user_id

  const { otherName, otherAvatarUrl, otherUsername } = await fetchOtherUser({
    supabase,
    otherUserId,
    preferFlipperBusinessName: isWorker,
  })

  // Load messages
  const { data: messages } = await supabase
    .from('gig_messages')
    .select('id, sender_user_id, body, read_at, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(200)

  const backHref = isWorker ? '/my-gigs' : '/flipper/dashboard'
  const backLabel = isWorker ? 'My Gigs' : 'My Posted Gigs'

  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {backLabel}
      </Link>

      <ChatClient
        conversationId={conversation.id}
        conversationKind="gig"
        currentUserId={user.id}
        otherUserId={otherUserId}
        otherName={otherName}
        otherAvatarUrl={otherAvatarUrl}
        otherUsername={otherUsername}
        contextLabel="About gig"
        contextTitle={conversation.gigs?.title ?? 'Gig'}
        contextHref={
          conversation.gigs?.slug ? `/gigs/${conversation.gigs.slug}` : null
        }
        initialMessages={
          (messages as Array<{
            id: string
            sender_user_id: string
            body: string
            read_at: string | null
            created_at: string
          }>) ?? []
        }
      />
    </div>
  )
}

// ----- LISTING conversation -----
async function renderListingConversation({
  supabase,
  user,
  conversation,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  user: { id: string }
  conversation: {
    id: string
    listing_id: string
    seller_user_id: string
    buyer_user_id: string
    created_at: string
  }
}) {
  const isSeller = conversation.seller_user_id === user.id
  const isBuyer = conversation.buyer_user_id === user.id
  if (!isSeller && !isBuyer) notFound()

  const otherUserId = isSeller
    ? conversation.buyer_user_id
    : conversation.seller_user_id

  const { otherName, otherAvatarUrl, otherUsername } = await fetchOtherUser({
    supabase,
    otherUserId,
    preferFlipperBusinessName: false,
  })

  // Load the listing for the header
  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, title, slug, status')
    .eq('id', conversation.listing_id)
    .maybeSingle()

  // Load messages from listing_messages
  const { data: messages } = await supabase
    .from('listing_messages')
    .select('id, sender_user_id, body, read_at, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(200)

  return (
    <div className="space-y-4">
      <Link
        href="/messages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to messages
      </Link>

      <ChatClient
        conversationId={conversation.id}
        conversationKind="listing"
        currentUserId={user.id}
        otherUserId={otherUserId}
        otherName={otherName}
        otherAvatarUrl={otherAvatarUrl}
        otherUsername={otherUsername}
        contextLabel="About listing"
        contextTitle={listing?.title ?? 'Listing'}
        contextHref={listing?.slug ? `/marketplace/${listing.slug}` : null}
        initialMessages={
          (messages as Array<{
            id: string
            sender_user_id: string
            body: string
            read_at: string | null
            created_at: string
          }>) ?? []
        }
      />
    </div>
  )
}

// ----- USER-to-USER conversation -----
async function renderUserConversation({
  supabase,
  user,
  conversation,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  user: { id: string }
  conversation: {
    id: string
    user_a_id: string
    user_b_id: string
    created_at: string
  }
}) {
  const isA = conversation.user_a_id === user.id
  const isB = conversation.user_b_id === user.id
  if (!isA && !isB) notFound()

  const otherUserId = isA ? conversation.user_b_id : conversation.user_a_id

  const { otherName, otherAvatarUrl, otherUsername } = await fetchOtherUser({
    supabase,
    otherUserId,
    preferFlipperBusinessName: false,
  })

  // Load messages from user_messages
  const { data: messages } = await supabase
    .from('user_messages')
    .select('id, sender_user_id, body, read_at, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(200)

  return (
    <div className="space-y-4">
      <Link
        href="/messages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to messages
      </Link>

      <ChatClient
        conversationId={conversation.id}
        conversationKind="user"
        currentUserId={user.id}
        otherUserId={otherUserId}
        otherName={otherName}
        otherAvatarUrl={otherAvatarUrl}
        otherUsername={otherUsername}
        contextLabel="Direct message"
        contextTitle={otherName}
        contextHref={otherUsername ? `/u/${otherUsername}` : null}
        initialMessages={
          (messages as Array<{
            id: string
            sender_user_id: string
            body: string
            read_at: string | null
            created_at: string
          }>) ?? []
        }
      />
    </div>
  )
}

// Shared helper — figure out the other person's display name + avatar.
// Tries worker_profiles, then flipper_profiles. For gig conversations
// when the OTHER side is the flipper, we prefer business_name from
// flipper_profiles if set.
async function fetchOtherUser({
  supabase,
  otherUserId,
  preferFlipperBusinessName,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  otherUserId: string
  preferFlipperBusinessName: boolean
}) {
  let otherName = 'User'
  let otherAvatarUrl: string | null = null
  let otherUsername: string | null = null

  const { data: otherWorker } = await supabase
    .from('worker_profiles')
    .select('full_name, username, avatar_url')
    .eq('user_id', otherUserId)
    .maybeSingle()

  if (otherWorker) {
    const full = (otherWorker.full_name ?? '').trim()
    if (full) otherName = full
    if (otherWorker.avatar_url) otherAvatarUrl = otherWorker.avatar_url
    if (otherWorker.username) otherUsername = otherWorker.username
  }

  if (preferFlipperBusinessName) {
    const { data: otherFlipper } = await supabase
      .from('flipper_profiles')
      .select('business_name, username, avatar_url')
      .eq('user_id', otherUserId)
      .maybeSingle()
    if (otherFlipper) {
      if (otherFlipper.business_name && otherFlipper.business_name.trim()) {
        otherName = otherFlipper.business_name
      }
      if (otherFlipper.avatar_url) otherAvatarUrl = otherFlipper.avatar_url
      if (otherFlipper.username) otherUsername = otherFlipper.username
    }
  } else if (!otherWorker) {
    // No worker profile — try flipper as a fallback for marketplace
    // conversations (sellers might only have a flipper profile).
    const { data: otherFlipper } = await supabase
      .from('flipper_profiles')
      .select('business_name, username, avatar_url')
      .eq('user_id', otherUserId)
      .maybeSingle()
    if (otherFlipper) {
      if (otherFlipper.business_name && otherFlipper.business_name.trim()) {
        otherName = otherFlipper.business_name
      }
      if (otherFlipper.avatar_url) otherAvatarUrl = otherFlipper.avatar_url
      if (otherFlipper.username) otherUsername = otherFlipper.username
    }
  }

  return { otherName, otherAvatarUrl, otherUsername }
}
