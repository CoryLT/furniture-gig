import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/stripe/payment-method/setup-intent
 *
 * Phase 2: flipper saves a payment method.
 *
 * Creates a Stripe Customer for the logged-in user if they don't have one yet,
 * then returns a SetupIntent client_secret. The browser uses this with Stripe
 * Elements to collect card details and attach the resulting PaymentMethod to
 * the Customer for off-session reuse (Phase 3: authorize on pick).
 */
export async function POST() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY_LIVE) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 })
  }

  // Pull user row to see if we already created a Stripe Customer
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, stripe_customer_id' as any)
    .eq('id', user.id)
    .maybeSingle()

  if (userErr || !userRow) {
    return NextResponse.json(
      { error: 'Could not load user record.', detail: userErr?.message },
      { status: 500 }
    )
  }

  let customerId = (userRow as any).stripe_customer_id as string | null

  try {
    // Create the Customer if we don't have one yet
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          flipwork_user_id: user.id,
        },
      })
      customerId = customer.id

      const { error: saveError } = await (supabase as any)
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (saveError) {
        return NextResponse.json(
          { error: 'Could not save Stripe customer ID.', detail: saveError.message },
          { status: 500 }
        )
      }
    }

    // Create a SetupIntent for saving a card for future off-session charges
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Stripe API error',
        error_type: err?.type ?? 'unknown',
        message: err?.message ?? String(err),
      },
      { status: 500 }
    )
  }
}
