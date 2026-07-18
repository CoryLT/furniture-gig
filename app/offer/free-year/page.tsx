import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Sparkles, Crown, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPro } from '@/lib/plan'
import AcceptOfferButton from './AcceptOfferButton'
import { CAMPAIGN_ID } from '@/app/api/offer/free-year/accept/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// /offer/free-year
// ============================================================
// The landing page linked from the free-year offer email. Sign-in
// required — if the user isn't signed in we bounce them through
// the login flow and back here. The page shows one of four states:
//
//   1. Already redeemed — "You're all set" with a link into the app
//   2. Already paying Pro — "You don't need this, you're already Pro"
//   3. Fresh redemption available — big Accept button
//   4. Comp expired / other edge — same as fresh, we upsert on accept
//
// Actual redemption is a POST to /api/offer/free-year/accept.
// ============================================================

export default async function OfferFreeYearPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/offer/free-year')
  }

  const admin = createAdminClient()

  // Check redemption + current plan in parallel.
  const [redemptionRes, subRes] = await Promise.all([
    admin
      .from('campaign_redemptions')
      .select('id, redeemed_at')
      .eq('campaign_id', CAMPAIGN_ID)
      .eq('user_id', user!.id)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select(
        'status, is_founding, stripe_customer_id, current_period_end, comp_expires_at',
      )
      .eq('user_id', user!.id)
      .maybeSingle(),
  ])

  const alreadyRedeemed = !!redemptionRes.data
  const pro = isPro(subRes.data as any)
  const compExpiresAt =
    ((subRes.data as any)?.comp_expires_at as string | null) ?? null
  const alreadyPaid =
    (subRes.data as any)?.is_founding === true ||
    (subRes.data as any)?.status === 'active' ||
    (subRes.data as any)?.status === 'trialing'

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center">
              <Crown className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                A gift from FlipWork
              </p>
              <h1 className="text-2xl font-serif text-foreground">
                One free year of FlipWork Pro
              </h1>
            </div>
          </div>

          {alreadyRedeemed ? (
            <RedeemedState
              redeemedAt={
                (redemptionRes.data as any)?.redeemed_at as string
              }
              compExpiresAt={compExpiresAt}
            />
          ) : alreadyPaid ? (
            <AlreadyPaidState pro={pro} />
          ) : (
            <FreshOfferState />
          )}
        </div>
      </div>
    </main>
  )
}

// ------------------------------------------------------------
// State: fresh offer — the actual accept flow
// ------------------------------------------------------------
function FreshOfferState() {
  return (
    <>
      <p className="text-sm text-foreground leading-relaxed mb-4">
        As a thank-you for signing up early, we&rsquo;re giving you{' '}
        <span className="font-semibold">a full year of FlipWork Pro on the
        house</span>. That&rsquo;s the receipt scanner, tax-year summary, 1099
        tracking, and unlimited pieces — free until this time next year.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        There&rsquo;s no card required. If you love it after your free year,
        you can start paying then. If not, your account just goes back to Free
        — no surprise charges.
      </p>
      <AcceptOfferButton />
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Only offer available. One per account.
      </p>
    </>
  )
}

// ------------------------------------------------------------
// State: already redeemed
// ------------------------------------------------------------
function RedeemedState({
  redeemedAt,
  compExpiresAt,
}: {
  redeemedAt: string
  compExpiresAt: string | null
}) {
  const expiresLabel = compExpiresAt
    ? new Date(compExpiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  const redeemedLabel = redeemedAt
    ? new Date(redeemedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <p className="text-lg text-foreground">You&rsquo;re all set</p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        You accepted this offer
        {redeemedLabel ? <> on {redeemedLabel}</> : null}.
        {expiresLabel ? (
          <>
            {' '}
            Your Pro access runs through{' '}
            <span className="font-medium text-foreground">{expiresLabel}</span>.
          </>
        ) : null}
      </p>
      <Link
        href="/play"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent/90"
      >
        <Sparkles className="w-4 h-4" />
        Open FlipWork
      </Link>
    </>
  )
}

// ------------------------------------------------------------
// State: already on paid or founding Pro
// ------------------------------------------------------------
function AlreadyPaidState({ pro }: { pro: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <p className="text-lg text-foreground">
          You&rsquo;re already on Pro
        </p>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        No need for the offer —{' '}
        {pro ? 'your Pro access is already active' : 'your account already has full access'}
        . Keep flipping.
      </p>
      <Link
        href="/play"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent/90"
      >
        <Sparkles className="w-4 h-4" />
        Open FlipWork
      </Link>
    </>
  )
}
