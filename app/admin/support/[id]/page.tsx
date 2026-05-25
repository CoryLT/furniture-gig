import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import AdminSupportActions from './AdminSupportActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminSupportConversationPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if ((userRow as any)?.role !== 'admin') redirect('/')

  // Use admin client so we can fetch user details without worrying
  // about RLS on auth.users
  const admin = createAdminClient()

  const { data: convo } = await admin
    .from('support_conversations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!convo) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p>Conversation not found.</p>
        <Link href="/admin/support" className="text-stone-600 underline">
          Back to support
        </Link>
      </main>
    )
  }

  const { data: messages } = await admin
    .from('support_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  // Look up user info
  const { data: userInfoRow } = await admin
    .from('users')
    .select('email')
    .eq('id', (convo as any).user_id)
    .maybeSingle()

  const { data: workerProfile } = await admin
    .from('worker_profiles')
    .select('first_name, last_name, username, phone')
    .eq('user_id', (convo as any).user_id)
    .maybeSingle()

  const userName = [
    (workerProfile as any)?.first_name,
    (workerProfile as any)?.last_name,
  ]
    .filter(Boolean)
    .join(' ')
  const email = (userInfoRow as any)?.email || 'unknown'

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/admin/support"
        className="inline-flex items-center text-sm text-stone-600 hover:text-stone-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to support
      </Link>

      <div className="border border-stone-200 rounded-lg bg-white p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-serif">
              {userName || (workerProfile as any)?.username || 'User'}
            </h1>
            <p className="text-sm text-stone-600">{email}</p>
            {(workerProfile as any)?.username && (
              <Link
                href={`/u/${(workerProfile as any).username}`}
                className="text-xs text-stone-500 underline"
              >
                View profile
              </Link>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-stone-500">
              Status
            </div>
            <div className="font-medium capitalize">
              {(convo as any).status}
            </div>
            {(convo as any).escalation_reason && (
              <div className="text-xs text-amber-700 mt-1">
                Reason: {(convo as any).escalation_reason}
              </div>
            )}
          </div>
        </div>

        {(convo as any).summary && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
            <div className="text-xs uppercase tracking-wide text-amber-800 mb-1">
              AI summary
            </div>
            {(convo as any).summary}
          </div>
        )}

        <AdminSupportActions
          conversationId={params.id}
          currentStatus={(convo as any).status}
        />
      </div>

      <div className="border border-stone-200 rounded-lg bg-white p-4 space-y-3">
        {(messages || []).map((m: any) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-900'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                {m.role === 'user' ? userName || 'User' : 'AI'}{' '}
                · {new Date(m.created_at).toLocaleString()}
              </div>
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
