import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { getPlan, isPro, PRO_PRICE_LABEL } from '@/lib/plan'
import { UpgradeButton, ManageButton } from '@/components/billing/BillingButtons'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const freePerks = [
  'Unlimited pieces in your Pipeline',
  'Photos, profit & cash tracking',
  'Books: log sales & expenses',
  'Dashboard & charts',
]
const proPerks = [
  'Receipt scanner (snap a photo)',
  'Tax-year summary & CSV export',
  'Payment records & 1099 tracking',
  'New Pro tools as they ship',
  'Everything in Free',
]

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: { ok?: string; canceled?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const plan = await getPlan(supabase, user.id)
  const pro = isPro(plan)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/books"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="mt-4 text-center">
        <h1 className="font-serif text-3xl text-foreground">FlipWork Pro</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Start free. Upgrade when your flipping outgrows the free limits — no app store, cancel
          anytime.
        </p>
      </div>

      {searchParams?.ok && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          You&apos;re on Pro now — thank you! It may take a few seconds to unlock everything.
        </div>
      )}
      {searchParams?.canceled && (
        <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          No charge — you can upgrade whenever you&apos;re ready.
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* Free */}
        <div className="rounded-2xl border border-border p-5">
          <div className="text-sm font-medium text-muted-foreground">Free</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            $0<span className="text-base font-normal text-muted-foreground">/mo</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            {freePerks.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {!pro && (
            <p className="mt-5 text-center text-sm text-muted-foreground">Your current plan</p>
          )}
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-accent p-5">
          <div className="text-sm font-medium text-accent">Pro</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {PRO_PRICE_LABEL.replace('/mo', '')}
            <span className="text-base font-normal text-muted-foreground">/mo</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            {proPerks.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {pro ? (
              <div className="space-y-2">
                <p className="text-center text-sm font-medium text-foreground">
                  You&apos;re on Pro 🎉
                </p>
                <ManageButton />
              </div>
            ) : (
              <UpgradeButton label={`Upgrade — ${PRO_PRICE_LABEL}`} />
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Secure checkout by Stripe. FlipWork never sees your card details.
      </p>
    </main>
  )
}
