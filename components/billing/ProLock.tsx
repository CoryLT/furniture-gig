import Link from 'next/link'
import { Lock } from 'lucide-react'
import { UpgradeButton } from '@/components/billing/BillingButtons'
import { PRO_PRICE_LABEL } from '@/lib/plan'

// Shown in place of a Pro feature when the user is on the free plan.
export default function ProLock({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <Lock className="h-5 w-5 text-accent" />
      </div>
      <h1 className="font-serif text-2xl text-foreground">{title} is a Pro feature</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{blurb}</p>
      <div className="mx-auto mt-6 max-w-xs">
        <UpgradeButton label={`Upgrade to Pro — ${PRO_PRICE_LABEL}`} />
      </div>
      <Link
        href="/upgrade"
        className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent/80"
      >
        See what&apos;s included →
      </Link>
    </div>
  )
}
