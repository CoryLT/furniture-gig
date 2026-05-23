import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stripe/connect/refresh
 *
 * Stripe redirects users here if their onboarding link expires. We just
 * generate a fresh accountLink and bounce them right back to Stripe.
 */
export async function GET(req: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('stripe_account_id' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  const stripeAccountId = (workerProfile as any)?.stripe_account_id as string | null

  if (!stripeAccountId) {
    // No account yet — send them to the payments page to start
    return NextResponse.redirect(new URL('/profile/payments', req.url))
  }

  const origin = new URL(req.url).origin

  try {
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/profile/payments/return`,
      type: 'account_onboarding',
    })
    return NextResponse.redirect(accountLink.url)
  } catch {
    return NextResponse.redirect(new URL('/profile/payments?error=refresh_failed', req.url))
  }
}
