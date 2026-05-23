import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stripe/connect/status
 *
 * Fetches the latest account state from Stripe for the logged-in worker,
 * syncs it back to worker_profiles, and returns a compact status object.
 *
 * Used by /profile/payments and /profile/payments/return to show fresh info.
 */
export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_onboarding_completed_at' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!workerProfile) {
    return NextResponse.json({
      connected: false,
      account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      ready: false,
    })
  }

  const p = workerProfile as any
  const stripeAccountId = p.stripe_account_id as string | null

  if (!stripeAccountId) {
    return NextResponse.json({
      connected: false,
      account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      ready: false,
    })
  }

  // Pull fresh state from Stripe
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)

    const chargesEnabled = !!account.charges_enabled
    const payoutsEnabled = !!account.payouts_enabled
    const detailsSubmitted = !!account.details_submitted

    // Sync to DB
    const updates: Record<string, any> = {
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
    }
    // Stamp completion time the first time we see fully-onboarded
    const wasComplete = !!p.stripe_onboarding_completed_at
    if (!wasComplete && chargesEnabled && payoutsEnabled && detailsSubmitted) {
      updates.stripe_onboarding_completed_at = new Date().toISOString()
    }

    await supabase
      .from('worker_profiles')
      .update(updates as any)
      .eq('user_id', user.id)

    // What's missing? (Stripe gives us currentlyDue / pastDue / disabled_reason)
    const requirements = account.requirements
    const currentlyDue: string[] = (requirements?.currently_due ?? []) as string[]
    const pastDue: string[] = (requirements?.past_due ?? []) as string[]
    const disabledReason = requirements?.disabled_reason ?? null

    return NextResponse.json({
      connected: true,
      account_id: stripeAccountId,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
      ready: chargesEnabled && payoutsEnabled && detailsSubmitted,
      currently_due: currentlyDue,
      past_due: pastDue,
      disabled_reason: disabledReason,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Stripe API error',
        message: err?.message ?? String(err),
      },
      { status: 500 }
    )
  }
}
