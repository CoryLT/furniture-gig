// ============================================================
// /marketplace/new
// ============================================================
// Auth gate for posting a new marketplace listing. Public users
// get bounced to signup. Logged-in users see the form.
//
// We deliberately do NOT require flipper or worker onboarding
// before listing — selling stuff on the marketplace doesn't need
// either of those. Just a logged-in account.
// ============================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/shared/Nav'
import NewListingForm from './NewListingForm'
import type { MarketplaceCategoryRow } from '@/types/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NewListingPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signup?next=/marketplace/new')
  }

  // Load active categories for the dropdown
  const { data: categoriesData } = await supabase
    .from('marketplace_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  const categories = (categoriesData ?? []) as MarketplaceCategoryRow[]

  // For Nav rendering
  let userRole: 'worker' | 'admin' | 'flipper' = 'worker'
  let userName: string | undefined
  let userUsername: string | undefined

  const { data: row } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (row?.role) userRole = (row as { role: typeof userRole }).role

  const { data: wp } = await supabase
    .from('worker_profiles')
    .select('first_name, username')
    .eq('user_id', user.id)
    .maybeSingle()
  if (wp) {
    const w = wp as { first_name: string | null; username: string | null }
    userName = w.first_name ?? undefined
    userUsername = w.username ?? undefined
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav role={userRole} userName={userName} userUsername={userUsername} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <NewListingForm categories={categories} />
      </main>
    </div>
  )
}
