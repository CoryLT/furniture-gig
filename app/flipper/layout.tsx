import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/shared/Nav'

export default async function FlipperLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userRow?.role !== 'flipper') redirect('/gigs')

  const { data: profile } = await supabase
    .from('flipper_profiles')
    .select('business_name, username')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <Nav role="flipper" userName={profile?.business_name ?? user.email ?? ''} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
