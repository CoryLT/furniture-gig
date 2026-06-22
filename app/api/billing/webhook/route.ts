import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe calls this when a subscription is created, changed, or canceled.
// We verify the signature, then write the result to the subscriptions table
// with the service role (bypasses RLS). Uses its OWN signing secret so it
// doesn't collide with any other Stripe webhook.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET
  const sig = req.headers.get('stripe-signature')
  if (!secret || !sig) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err: any) {
    return NextResponse.json({ error: `Bad signature: ${err?.message}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Write a subscription's current state, found by its Stripe customer id.
  async function applySubscription(sub: Stripe.Subscription) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    if (!customerId) return
    const periodEnd = (sub as any).current_period_end
      ? new Date((sub as any).current_period_end * 1000).toISOString()
      : null
    const priceId = sub.items?.data?.[0]?.price?.id ?? null

    const patch = {
      stripe_subscription_id: sub.id,
      status: sub.status, // active | trialing | past_due | canceled | ...
      price_id: priceId,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }

    // Prefer matching our existing row by customer id.
    const { data: row } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if ((row as any)?.user_id) {
      await admin.from('subscriptions').update(patch).eq('user_id', (row as any).user_id)
      return
    }

    // Fall back to the user_id stored in the Stripe customer's metadata.
    try {
      const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer
      const uid = customer.metadata?.user_id
      if (uid) {
        await admin
          .from('subscriptions')
          .upsert({ user_id: uid, stripe_customer_id: customerId, ...patch }, { onConflict: 'user_id' })
      }
    } catch {
      /* give up quietly — nothing safe to write */
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        const uid = s.client_reference_id
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id
        if (uid && customerId) {
          await admin
            .from('subscriptions')
            .upsert({ user_id: uid, stripe_customer_id: customerId }, { onConflict: 'user_id' })
        }
        if (s.subscription) {
          const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await applySubscription(sub as Stripe.Subscription)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await applySubscription(event.data.object as Stripe.Subscription)
        break
      }
      default:
        break
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
