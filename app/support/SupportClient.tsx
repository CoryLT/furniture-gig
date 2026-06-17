'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ConvSummary {
  id: string
  status: 'active' | 'resolved' | 'escalated'
  summary: string | null
  message_count: number
  last_message_at: string
}

interface Msg {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  pending?: boolean
}

interface Props {
  initialConversations: ConvSummary[]
}

export default function SupportClient({ initialConversations }: Props) {
  const [conversations, setConversations] = useState<ConvSummary[]>(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<ConvSummary['status'] | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Load a conversation's messages
  async function loadConversation(id: string) {
    setLoadingHistory(true)
    setError(null)
    try {
      const res = await fetch(`/api/support/conversation/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load conversation')
      const data = await res.json()
      setMessages(data.messages || [])
      setActiveId(id)
      setActiveStatus(data.conversation?.status || 'active')
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoadingHistory(false)
    }
  }

  // Start a new chat — just clears state. The conversation is
  // created server-side when the first message is sent.
  function startNew() {
    setActiveId(null)
    setActiveStatus(null)
    setMessages([])
    setError(null)
    setInput('')
  }

  async function send() {
    const text = input.trim()
    if (!text || sending) return

    setError(null)
    setSending(true)

    // Optimistic user message
    const tempId = `tmp-${Date.now()}`
    setMessages((m) => [
      ...m,
      {
        id: tempId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
        pending: true,
      },
    ])
    setInput('')

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, message: text }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        // Remove the optimistic message on error
        setMessages((m) => m.filter((x) => x.id !== tempId))
        setSending(false)
        return
      }

      // Replace optimistic message with confirmed + add assistant reply
      setMessages((m) => {
        const cleaned = m.filter((x) => x.id !== tempId)
        return [
          ...cleaned,
          {
            id: `u-${Date.now()}`,
            role: 'user',
            content: text,
            created_at: new Date().toISOString(),
          },
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply,
            created_at: new Date().toISOString(),
          },
        ]
      })
      setActiveId(data.conversationId)
      setActiveStatus(data.status)

      // Refresh conversation list
      const listRes = await fetch('/api/support/conversations', { cache: 'no-store' })
      if (listRes.ok) {
        const listData = await listRes.json()
        setConversations(listData.conversations || [])
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
      setMessages((m) => m.filter((x) => x.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  async function markResolved() {
    if (!activeId) return
    try {
      const res = await fetch('/api/support/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId }),
      })
      if (res.ok) {
        setActiveStatus('resolved')
        const listRes = await fetch('/api/support/conversations', { cache: 'no-store' })
        if (listRes.ok) {
          const listData = await listRes.json()
          setConversations(listData.conversations || [])
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-[600px]">
      {/* Sidebar */}
      <aside className="border border-border rounded-lg p-3 bg-card">
        <Button
          onClick={startNew}
          variant="default"
          size="sm"
          className="w-full mb-3"
        >
          <Plus className="w-4 h-4 mr-1" />
          New chat
        </Button>

        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Recent
        </div>

        {conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No chats yet.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left px-2 py-2 rounded text-sm hover:bg-muted ${
                    activeId === c.id ? 'bg-muted font-medium' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {c.summary || 'Support chat'}
                    </span>
                    {c.status === 'escalated' && (
                      <AlertCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                    )}
                    {c.status === 'resolved' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(c.last_message_at).toLocaleDateString()} ·{' '}
                    {c.message_count} message{c.message_count === 1 ? '' : 's'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Chat panel */}
      <section className="border border-border rounded-lg bg-card flex flex-col min-h-[600px]">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">FlipWork Support</span>
            {activeStatus === 'escalated' && (
              <span className="text-xs px-2 py-0.5 bg-accent/15 text-accent rounded">
                Flagged for admin
              </span>
            )}
            {activeStatus === 'resolved' && (
              <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                Resolved
              </span>
            )}
          </div>
          {activeId && activeStatus === 'active' && (
            <button
              onClick={markResolved}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Mark resolved
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground mt-12 px-4">
              <p className="text-base">Hi! How can I help?</p>
              <p className="text-sm mt-2">
                I can answer questions about gigs, payments, your account, and more.
                Just type below to start.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-accent text-accent-foreground whitespace-pre-wrap'
                      : 'bg-muted text-foreground chat-markdown'
                  } ${m.pending ? 'opacity-60' : ''}`}
                >
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Render links so they're clickable and open in new tab
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-foreground hover:text-accent"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-t border-red-100">
            {error}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border p-3">
          {activeStatus === 'resolved' ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              This chat is resolved.{' '}
              <button onClick={startNew} className="underline hover:text-foreground">
                Start a new chat
              </button>
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="flex gap-2 items-end"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Ask anything about FlipWork..."
                disabled={sending}
                rows={1}
                className="flex-1 resize-none border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent max-h-32"
              />
              <Button
                type="submit"
                disabled={!input.trim() || sending}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
