import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/stripe/connect/login-link
 *
 * Generates a one-time login link to the worker's Stripe Express Dashboard,
 * where they can update bank info, view payouts, etc.
 */
export async function POST() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('stripe_account_id' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  const stripeAccountId = (workerProfile as any)?.stripe_account_id as string | null

  if (!stripeAccountId) {
    return NextResponse.json({ error: 'No Stripe account connected.' }, { status: 400 })
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId)
    return NextResponse.json({ url: loginLink.url })
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Could not create login link',
        message: err?.message ?? String(err),
      },
      { status: 500 }
    )
  }
}
