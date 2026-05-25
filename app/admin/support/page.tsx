import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, MessageCircle, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ConvRow = {
  id: string
  user_id: string
  status: string
  summary: string | null
  escalation_reason: string | null
  message_count: number
  created_at: string
  last_message_at: string
}

const TABS = [
  { key: 'escalated', label: 'Escalated' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
] as const

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/admin/support')

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if ((userRow as any)?.role !== 'admin') {
    redirect('/')
  }

  const tab = (searchParams.tab || 'escalated') as 'escalated' | 'resolved' | 'all'

  let query = supabase
    .from('support_conversations')
    .select('id, user_id, status, summary, escalation_reason, message_count, created_at, last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(100)

  if (tab !== 'all') {
    query = query.eq('status', tab)
  }

  const { data: rows } = await query
  const conversations = (rows as ConvRow[]) || []

  // Lookup user names for display
  const userIds = Array.from(new Set(conversations.map((c) => c.user_id)))
  let nameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('worker_profiles')
      .select('user_id, first_name, last_name, username')
      .in('user_id', userIds)
    for (const p of (profiles as any[]) || []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
      nameMap[p.user_id] = name || p.username || 'User'
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center text-sm text-stone-600 hover:text-stone-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to admin
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-serif tracking-tight flex items-center gap-2">
          <MessageCircle className="w-7 h-7" />
          Support
        </h1>
        <p className="text-stone-600 mt-1">
          AI support conversations. Escalated chats need your attention.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 mb-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/support?tab=${t.key}`}
            className={`px-4 py-2 text-sm border-b-2 ${
              tab === t.key
                ? 'border-stone-900 text-stone-900 font-medium'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {conversations.length === 0 ? (
        <p className="text-stone-500 py-8 text-center">No conversations in this tab.</p>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/support/${c.id}`}
                className="block border border-stone-200 rounded-lg p-4 hover:bg-stone-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {nameMap[c.user_id] || 'User'}
                      </span>
                      {c.status === 'escalated' && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {c.escalation_reason || 'escalated'}
                        </span>
                      )}
                      {c.status === 'resolved' && (
                        <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                          resolved
                        </span>
                      )}
                      {c.status === 'active' && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                          active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-700 line-clamp-2">
                      {c.summary || 'No summary yet.'}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      {new Date(c.last_message_at).toLocaleString()} ·{' '}
                      {c.message_count} message{c.message_count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
