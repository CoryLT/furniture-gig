import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSiteUrl } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Opens the Stripe Customer Portal so the user can update their card or
// cancel — all handled by Stripe, no work for the operator.
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customerId = (sub as any)?.stripe_customer_id as string | undefined
  if (!customerId) {
    return NextResponse.json({ error: 'No subscription to manage yet.' }, { status: 400 })
  }

  const base = getSiteUrl()
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/upgrade`,
  })

  return NextResponse.json({ url: portal.url })
}
