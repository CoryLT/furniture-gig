'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Send, User, ExternalLink } from 'lucide-react'

interface Message {
  id: string
  sender_user_id: string
  body: string
  read_at: string | null
  created_at: string
  // Optimistic UI flag — true when the message hasn't been confirmed by the server yet
  pending?: boolean
}

type ConversationKind = 'gig' | 'listing' | 'user'

interface Props {
  conversationId: string
  conversationKind: ConversationKind
  currentUserId: string
  otherUserId: string
  otherName: string
  otherAvatarUrl: string | null
  otherUsername: string | null
  // Header context: a short label + a title + (optional) link target
  contextLabel: string
  contextTitle: string
  contextHref: string | null
  initialMessages: Array<{
    id: string
    sender_user_id: string
    body: string
    read_at: string | null
    created_at: string
  }>
}

// How long after typing stops before we tell the other side we stopped
const TYPING_STOP_MS = 2500

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ChatClient({
  conversationId,
  conversationKind,
  currentUserId,
  otherUserId,
  otherName,
  otherAvatarUrl,
  otherUsername,
  contextLabel,
  contextTitle,
  contextHref,
  initialMessages,
}: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [otherIsTyping, setOtherIsTyping] = useState(false)

  // The Postgres table name we read/write messages from
  const messagesTable =
    conversationKind === 'gig'
      ? 'gig_messages'
      : conversationKind === 'user'
      ? 'user_messages'
      : 'listing_messages'
  // Realtime channel name — must be unique per conversation per kind
  const channelName = `${conversationKind}-conversation:${conversationId}`

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef<number>(0)

  // --- Scroll to bottom when messages change ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, otherIsTyping])

  // --- Mark unread messages from the other person as read on mount ---
  useEffect(() => {
    async function markRead() {
      const unreadIds = messages
        .filter((m) => m.sender_user_id === otherUserId && !m.read_at)
        .map((m) => m.id)
      if (unreadIds.length === 0) return
      await supabase
        .from(messagesTable)
        // @ts-expect-error supabase update generics
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
    }
    markRead()
    // Only on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Realtime: subscribe to new messages, message updates, and typing events ---
  useEffect(() => {
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    })

    // INSERTs (new messages)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: messagesTable,
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const m = payload.new as Message
        setMessages((prev) => {
          // If it's our own optimistic message, replace it
          if (m.sender_user_id === currentUserId) {
            const idx = prev.findIndex(
              (p) => p.pending && p.body === m.body && p.sender_user_id === currentUserId
            )
            if (idx >= 0) {
              const next = prev.slice()
              next[idx] = m
              return next
            }
          }
          // Otherwise, append if not already there
          if (prev.some((p) => p.id === m.id)) return prev
          return [...prev, m]
        })

        // If the new message is from the other person, mark it read right away
        if (m.sender_user_id === otherUserId) {
          supabase
            .from(messagesTable)
            // @ts-expect-error supabase update generics
            .update({ read_at: new Date().toISOString() })
            .eq('id', m.id)
            .then(() => {})
        }
      }
    )

    // UPDATEs (read receipts changing on our own messages)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: messagesTable,
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const m = payload.new as Message
        setMessages((prev) =>
          prev.map((p) => (p.id === m.id ? { ...p, read_at: m.read_at } : p))
        )
      }
    )

    // Typing indicator via broadcast
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const fromUserId = (payload.payload as { userId: string }).userId
      if (fromUserId === currentUserId) return // ignore our own
      setOtherIsTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setOtherIsTyping(false), TYPING_STOP_MS)
    })
    channel.on('broadcast', { event: 'stop_typing' }, (payload) => {
      const fromUserId = (payload.payload as { userId: string }).userId
      if (fromUserId === currentUserId) return
      setOtherIsTyping(false)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId, otherUserId, messagesTable, channelName])

  // --- Send a typing event, throttled to once every 1.5s ---
  function broadcastTyping() {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 1500) return
    lastTypingSentRef.current = now
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId },
    })
  }

  function broadcastStopTyping() {
    lastTypingSentRef.current = 0
    channelRef.current?.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { userId: currentUserId },
    })
  }

  // --- Send a message ---
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    setError('')

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      sender_user_id: currentUserId,
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    broadcastStopTyping()

    const { data, error: insertError } = await supabase
      .from(messagesTable)
      .insert({
        conversation_id: conversationId,
        sender_user_id: currentUserId,
        body: text,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select('id, sender_user_id, body, read_at, created_at')
      .single()

    if (insertError) {
      setError('Could not send. Try again.')
      // Remove the optimistic message
      setMessages((prev) => prev.filter((p) => p.id !== tempId))
      setDraft(text)
      setSending(false)
      return
    }

    // Replace the optimistic message with the real one (the realtime INSERT
    // may also arrive — the merge logic above handles that)
    if (data) {
      const inserted = data as Message
      setMessages((prev) => {
        const idx = prev.findIndex((p) => p.id === tempId)
        if (idx < 0) {
          // Already replaced by realtime
          if (prev.some((p) => p.id === inserted.id)) return prev
          return [...prev, inserted]
        }
        const next = prev.slice()
        next[idx] = inserted
        return next
      })
    }

    setSending(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Header */}
      <div className="border-b border-stone-200 p-4 flex items-center gap-3">
        {otherUsername ? (
          <Link href={`/u/${otherUsername}`} className="flex-shrink-0">
            <AvatarBubble name={otherName} avatarUrl={otherAvatarUrl} />
          </Link>
        ) : (
          <AvatarBubble name={otherName} avatarUrl={otherAvatarUrl} />
        )}
        <div className="min-w-0 flex-1">
          {otherUsername ? (
            <Link href={`/u/${otherUsername}`} className="font-medium text-foreground hover:text-accent transition-colors truncate block">
              {otherName}
            </Link>
          ) : (
            <div className="font-medium text-foreground truncate">{otherName}</div>
          )}
          <div className="text-xs text-muted-foreground truncate">
            {contextLabel}:{' '}
            {contextHref ? (
              <Link href={contextHref} className="hover:underline inline-flex items-center gap-0.5">
                {contextTitle} <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <span>{contextTitle}</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Say hi!
          </div>
        )}
        {messages.map((m, idx) => {
          const mine = m.sender_user_id === currentUserId
          const prev = messages[idx - 1]
          const showAvatar = !mine && (!prev || prev.sender_user_id !== m.sender_user_id)
          const isLastFromMe = mine && (idx === messages.length - 1 || messages[idx + 1]?.sender_user_id !== currentUserId)
          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
            >
              {!mine && (
                <div className="flex-shrink-0 w-7">
                  {showAvatar && (
                    <AvatarBubble name={otherName} avatarUrl={otherAvatarUrl} size="sm" />
                  )}
                </div>
              )}
              <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words ${
                    mine
                      ? 'bg-foreground text-background rounded-br-sm'
                      : 'bg-white border border-stone-200 text-foreground rounded-bl-sm'
                  } ${m.pending ? 'opacity-60' : ''}`}
                >
                  {m.body}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
                  <span>{formatTime(m.created_at)}</span>
                  {mine && isLastFromMe && !m.pending && (
                    <span>· {m.read_at ? 'Seen' : 'Sent'}</span>
                  )}
                  {m.pending && <span>· Sending…</span>}
                </div>
              </div>
            </div>
          )
        })}

        {otherIsTyping && (
          <div className="flex items-end gap-2 justify-start">
            <div className="flex-shrink-0 w-7">
              <AvatarBubble name={otherName} avatarUrl={otherAvatarUrl} size="sm" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-3 py-2.5">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-stone-200 p-3 flex items-end gap-2 bg-white"
      >
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (e.target.value.trim().length > 0) broadcastTyping()
            else broadcastStopTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend(e as unknown as React.FormEvent)
            }
          }}
          onBlur={broadcastStopTyping}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent max-h-32"
          style={{ minHeight: '40px' }}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="bg-accent text-accent-foreground rounded-lg p-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

function AvatarBubble({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string
  avatarUrl: string | null
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-sm'
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  if (avatarUrl) {
    return (
      <div className={`relative ${sizeClass} rounded-full overflow-hidden bg-stone-200 flex-shrink-0`}>
        <Image src={avatarUrl} alt={name} fill sizes="40px" className="object-cover" />
      </div>
    )
  }
  return (
    <div className={`${sizeClass} rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-medium flex-shrink-0`}>
      {initials || <User className="w-4 h-4" />}
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span>
    </span>
  )
}
