import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Always fresh — auth state and redirect target both vary
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Logged-in users go to their personalized dashboard
  if (user) {
    redirect('/home')
  }

  // Logged-out users land on the public marketplace feed.
  // This is the new front door — the marketplace is the hook.
  redirect('/marketplace')
}
