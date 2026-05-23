import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function StripeReturnPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Pull worker profile + Stripe account ID
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('stripe_account_id' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  const stripeAccountId = (workerProfile as any)?.stripe_account_id as string | null

  let isReady = false
  let detailsSubmitted = false
  let errorMessage = ''

  if (stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(stripeAccountId)
      const chargesEnabled = !!account.charges_enabled
      const payoutsEnabled = !!account.payouts_enabled
      detailsSubmitted = !!account.details_submitted
      isReady = chargesEnabled && payoutsEnabled && detailsSubmitted

      // Sync to DB
      const updates: Record<string, any> = {
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_details_submitted: detailsSubmitted,
      }
      if (isReady) {
        updates.stripe_onboarding_completed_at = new Date().toISOString()
      }
      await supabase
        .from('worker_profiles')
        .update(updates as any)
        .eq('user_id', user.id)
    } catch (err: any) {
      errorMessage = err?.message ?? 'Could not fetch Stripe account status.'
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          {isReady ? (
            <>
              <div className="inline-flex w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
                You&apos;re all set!
              </h1>
              <p className="text-slate-600 mb-6">
                Your Stripe account is fully verified. You can now apply to gigs and receive payouts directly to your bank.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/gigs">
                  <Button variant="accent" className="gap-2 w-full sm:w-auto">
                    Browse gigs
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/profile/payments">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Back to payments
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex w-16 h-16 rounded-full bg-amber-100 items-center justify-center mb-4">
                <AlertTriangle className="w-10 h-10 text-amber-600" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
                {detailsSubmitted ? 'Almost there' : 'Onboarding not finished'}
              </h1>
              <p className="text-slate-600 mb-6">
                {detailsSubmitted
                  ? 'Stripe is still reviewing your information. This usually takes a few minutes. Check back shortly.'
                  : 'It looks like you didn\'t finish the Stripe onboarding form. You can pick up where you left off.'}
              </p>
              {errorMessage && (
                <p className="text-sm text-red-700 mb-4">{errorMessage}</p>
              )}
              <Link href="/profile/payments">
                <Button variant="accent">Back to payments</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
