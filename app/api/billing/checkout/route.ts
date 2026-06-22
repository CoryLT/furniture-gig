import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSiteUrl } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Starts a Stripe Checkout session for the FlipWork Pro subscription and
// returns its URL. The browser then redirects there. FlipWork never sees
// the card — Stripe hosts the payment page.
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  const priceId = process.env.STRIPE_PRICE_ID_PRO
  if (!priceId) {
    return NextResponse.json({ error: 'Billing is not set up yet.' }, { status: 500 })
  }

  const admin = createAdminClient()

  // Reuse an existing Stripe customer if we already made one for this user.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let customerId = (existing as any)?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    await admin
      .from('subscriptions')
      .upsert({ user_id: user.id, stripe_customer_id: customerId, status: 'free' }, { onConflict: 'user_id' })
  }

  const base = getSiteUrl()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: `${base}/upgrade?ok=1`,
    cancel_url: `${base}/upgrade?canceled=1`,
  })

  return NextResponse.json({ url: session.url })
}
