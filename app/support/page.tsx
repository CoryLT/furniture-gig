import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/shared/Nav'
import SupportClient from './SupportClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SupportPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login?next=/support')
  }

  // Figure out the user's role for Nav
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = ((userRow as any)?.role || 'worker') as 'worker' | 'admin' | 'flipper'

  // Resolve a display name + username for Nav
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('first_name, last_name, username')
    .eq('user_id', user.id)
    .maybeSingle()

  const firstName = (workerProfile as any)?.first_name
  const lastName = (workerProfile as any)?.last_name
  const username = (workerProfile as any)?.username
  const userName = [firstName, lastName].filter(Boolean).join(' ') || user.email || ''

  // Load conversation list to show in sidebar
  const { data: conversations } = await supabase
    .from('support_conversations')
    .select('id, status, summary, message_count, last_message_at')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })
    .limit(20)

  return (
    <>
      <Nav role={role} userName={userName} userUsername={username} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-serif tracking-tight">Support</h1>
          <p className="text-stone-600 mt-1">
            Chat with our AI assistant. It can answer questions, look up your gigs and
            payouts, and flag anything important for our team.
          </p>
        </header>

        <SupportClient
          initialConversations={(conversations as any) || []}
        />
      </main>
    </>
  )
}
