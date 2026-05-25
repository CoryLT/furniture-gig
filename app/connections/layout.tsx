import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/shared/Nav'

export default async function ConnectionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Admins use their own area
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: 'worker' | 'admin' | 'flipper' }>()
  if (userRow?.role === 'admin') redirect('/admin')

  // Find a username for the nav (worker first, flipper fallback)
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('username, first_name, last_name')
    .eq('user_id', user.id)
    .single<{ username: string | null; first_name: string; last_name: string }>()

  let username = workerProfile?.username ?? null
  let displayName: string | null =
    workerProfile && (workerProfile.first_name || workerProfile.last_name)
      ? `${workerProfile.first_name} ${workerProfile.last_name}`.trim()
      : null

  if (!username) {
    const { data: flipperProfile } = await supabase
      .from('flipper_profiles')
      .select('username, business_name')
      .eq('user_id', user.id)
      .single<{ username: string | null; business_name: string }>()
    if (flipperProfile?.username) username = flipperProfile.username
    if (!displayName && flipperProfile?.business_name)
      displayName = flipperProfile.business_name
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav
        role="worker"
        userName={displayName ?? user.email ?? undefined}
        userUsername={username ?? undefined}
      />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
