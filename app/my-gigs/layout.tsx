import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/shared/Nav'

export default async function MyGigsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Only workers belong here — send other roles to their own home
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userRow?.role === 'admin') redirect('/admin')
  if (userRow?.role === 'flipper') redirect('/flipper/dashboard')

  const { data: profile } = await supabase
    .from('worker_profiles')
    .select('first_name, last_name')
    .eq('user_id', user.id)
    .single()

  const userName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || user.email
    : user.email

  return (
    <div className="min-h-screen flex flex-col">
      <Nav role="worker" userName={userName ?? undefined} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
