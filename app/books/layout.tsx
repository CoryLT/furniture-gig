import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/shared/Nav'

// Gives every /books page the same top nav as the rest of the app.
// Unlike the flipper/gigs layouts, this one does NOT bounce admins to
// /admin — the operator (including the single admin) uses Books directly.
export default async function BooksLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('flipper_profiles')
    .select('business_name, username')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-background">
      <Nav
        role="flipper"
        userName={profile?.business_name ?? user.email ?? ''}
        userUsername={profile?.username ?? undefined}
      />
      {children}
    </div>
  )
}
