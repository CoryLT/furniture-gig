import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgreementsClient from './AgreementsClient'

function homeForRole(role: string | null | undefined): string {
  if (role === 'admin') return '/admin'
  if (role === 'flipper') return '/flipper/dashboard'
  return '/gigs'
}

export default async function AgreementsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Look up the user's app role so we know where to send them after acceptance
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const home = homeForRole(userRow?.role)

  // Load all required active agreements
  const { data: agreements } = await supabase
    .from('legal_agreements')
    .select('*')
    .eq('required', true)
    .eq('active', true)
    .order('created_at')

  // Load which ones this user has already accepted
  const { data: acceptances } = await supabase
    .from('user_agreement_acceptances')
    .select('agreement_id')
    .eq('user_id', user.id)

  const acceptedIds = new Set(acceptances?.map((a) => a.agreement_id) ?? [])
  const pending = (agreements ?? []).filter((ag) => !acceptedIds.has(ag.id))

  // All done — go to the role-appropriate home
  if (pending.length === 0) {
    redirect(home)
  }

  return <AgreementsClient agreements={pending} home={home} />
}
