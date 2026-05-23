import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stripe/payment-method/status
 *
 * Phase 2: returns whether the logged-in flipper has at least one usable
 * saved card on their Stripe Customer.
 *
 * Used by the "Pick this worker" flow to decide whether to open the
 * Add-a-card modal or proceed directly to approve_applicant.
 */
export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id, stripe_customer_id' as any)
    .eq('id', user.id)
    .maybeSingle()

  const customerId = (userRow as any)?.stripe_customer_id as string | null

  if (!customerId) {
    return NextResponse.json({ hasPaymentMethod: false, paymentMethods: [] })
  }

  try {
    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 5,
    })

    const paymentMethods = list.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    }))

    return NextResponse.json({
      hasPaymentMethod: paymentMethods.length > 0,
      paymentMethods,
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
