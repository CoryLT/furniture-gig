import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PaymentsClient from './PaymentsClient'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Pull saved state from DB. Live state is fetched client-side via /api/stripe/connect/status.
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  const p = (workerProfile as any) ?? {}

  const initial = {
    connected: !!p.stripe_account_id,
    accountId: (p.stripe_account_id as string | null) ?? null,
    chargesEnabled: !!p.stripe_charges_enabled,
    payoutsEnabled: !!p.stripe_payouts_enabled,
    detailsSubmitted: !!p.stripe_details_submitted,
  }

  return <PaymentsClient initial={initial} hasWorkerProfile={!!workerProfile} />
}
