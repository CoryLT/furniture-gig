import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/stripe/connect/onboard
 *
 * Starts (or resumes) Stripe Connect Express onboarding for the logged-in worker.
 *
 * Flow:
 *  1. If the worker doesn't already have a stripe_account_id, create a new Express account.
 *  2. Save the account ID to worker_profiles.
 *  3. Generate an AccountLink (hosted onboarding URL) and return it.
 *
 * The client redirects to the returned URL. After completion, Stripe sends the user back
 * to /profile/payments/return, where the server confirms account status.
 */
export async function POST(req: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (!process.env.STRIPE_SECRET_KEY_LIVE) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 500 })
  }

  // Pull worker profile (we need to know if they already have an account, and grab email)
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('user_id, stripe_account_id, stripe_details_submitted' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!workerProfile) {
    return NextResponse.json(
      { error: 'You need a worker profile before connecting Stripe. Save your profile first.' },
      { status: 400 }
    )
  }

  let stripeAccountId = (workerProfile as any).stripe_account_id as string | null

  // Build base URL for return/refresh links
  const origin = req.headers.get('origin')
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? 'http://localhost:3000'

  try {
    // Create the Express account if we don't have one yet
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          flipwork_user_id: user.id,
        },
      })
      stripeAccountId = account.id

      // Save back to worker_profiles
      const { error: saveError } = await supabase
        .from('worker_profiles')
        .update({ stripe_account_id: stripeAccountId } as any)
        .eq('user_id', user.id)

      if (saveError) {
        return NextResponse.json(
          { error: 'Could not save Stripe account ID.', detail: saveError.message },
          { status: 500 }
        )
      }
    }

    // Generate the hosted onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/profile/payments/return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
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
