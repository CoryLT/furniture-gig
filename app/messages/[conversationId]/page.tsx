import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import ChatClient from './ChatClient'

interface Props {
  params: { conversationId: string }
}

export default async function ConversationPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load the conversation + gig
  const { data: conversation } = await supabase
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
    .single<{
      id: string
      gig_id: string
      flipper_user_id: string
      worker_user_id: string
      created_at: string
      gigs: { id: string; title: string; slug: string } | null
    }>()

  if (!conversation) notFound()

  // Check the current user is one of the two participants
  const isFlipper = conversation.flipper_user_id === user.id
  const isWorker = conversation.worker_user_id === user.id
  if (!isFlipper && !isWorker) notFound()

  const otherUserId = isFlipper ? conversation.worker_user_id : conversation.flipper_user_id

  // Figure out the other person's display name & avatar — check both tables
  let otherName = 'User'
  let otherAvatarUrl: string | null = null
  let otherUsername: string | null = null

  // Worker profile (worker side info)
  const { data: otherWorker } = await supabase
    .from('worker_profiles')
    .select('first_name, last_name, username, avatar_url')
    .eq('user_id', otherUserId)
    .single<{
      first_name: string
      last_name: string
      username: string | null
      avatar_url: string
    }>()

  if (otherWorker) {
    const full = `${otherWorker.first_name} ${otherWorker.last_name}`.trim()
    if (full) otherName = full
    if (otherWorker.avatar_url) otherAvatarUrl = otherWorker.avatar_url
    if (otherWorker.username) otherUsername = otherWorker.username
  }

  // If the other side is the flipper for this gig, prefer business_name when set
  if (isWorker) {
    const { data: otherFlipper } = await supabase
      .from('flipper_profiles')
      .select('business_name, username, avatar_url')
      .eq('user_id', otherUserId)
      .single<{
        business_name: string
        username: string | null
        avatar_url: string
      }>()
    if (otherFlipper) {
      if (otherFlipper.business_name && otherFlipper.business_name.trim()) {
        otherName = otherFlipper.business_name
      }
      if (otherFlipper.avatar_url) otherAvatarUrl = otherFlipper.avatar_url
      if (otherFlipper.username) otherUsername = otherFlipper.username
    }
  }

  // Load existing messages (most recent 200, oldest first for display)
  const { data: messages } = await supabase
    .from('gig_messages')
    .select('id, sender_user_id, body, read_at, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(200)

  // Where the "back" button should go: workers → /my-gigs, flippers → /flipper/dashboard
  const backHref = isWorker ? '/my-gigs' : '/flipper/dashboard'
  const backLabel = isWorker ? 'My Gigs' : 'My Posted Gigs'

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {backLabel}
      </Link>

      <ChatClient
        conversationId={conversation.id}
        currentUserId={user.id}
        otherUserId={otherUserId}
        otherName={otherName}
        otherAvatarUrl={otherAvatarUrl}
        otherUsername={otherUsername}
        gigTitle={conversation.gigs?.title ?? 'Gig'}
        gigSlug={conversation.gigs?.slug ?? null}
        initialMessages={(messages as Array<{
          id: string
          sender_user_id: string
          body: string
          read_at: string | null
          created_at: string
        }>) ?? []}
      />
    </div>
  )
}
