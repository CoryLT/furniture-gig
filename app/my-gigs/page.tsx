import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, claimStatusClass, claimStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, ArrowRight } from 'lucide-react'

// Counts here change whenever a flipper accepts/rejects/cancels/deletes a gig
// the worker is attached to. Without these directives, Next.js will serve a
// stale cached count even after the underlying claim is gone.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type TabKey = 'active' | 'applications' | 'history'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'applications', label: 'Applications' },
  { key: 'history', label: 'History' },
]

export default async function MyGigsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Load all claims for this worker with gig details
  const { data: claims } = await supabase
    .from('gig_claims')
    .select(`
      *,
      gigs (*)
    `)
    .eq('worker_user_id', user!.id)
    .order('claimed_at', { ascending: false })

  const allClaims = claims ?? []

  const active = allClaims.filter((c: { status: string }) =>
    ['active', 'submitted_for_review'].includes(c.status)
  )
  const applications = allClaims.filter((c: { status: string }) => c.status === 'pending')
  const history = allClaims.filter((c: { status: string }) =>
    ['approved', 'rejected', 'cancelled'].includes(c.status)
  )

  const tabFromUrl = (searchParams?.tab ?? 'active') as TabKey
  const currentTab: TabKey = (['active', 'applications', 'history'] as TabKey[]).includes(tabFromUrl)
    ? tabFromUrl
    : 'active'

  const counts: Record<TabKey, number> = {
    active: active.length,
    applications: applications.length,
    history: history.length,
  }

  const visibleClaims =
    currentTab === 'active' ? active : currentTab === 'applications' ? applications : history

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">My Gigs</h1>
        <p className="text-muted-foreground mt-1">Your applications, active gigs, and history.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.key
            return (
              <Link
                key={tab.key}
                href={`/my-gigs?tab=${tab.key}`}
                className={
                  isActive
                    ? 'px-4 py-2 text-sm font-medium border-b-2 border-accent text-foreground'
                    : 'px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors'
                }
              >
                {tab.label}
                <span
                  className={
                    isActive
                      ? 'ml-2 px-1.5 py-0.5 rounded-full text-xs bg-accent text-accent-foreground'
                      : 'ml-2 px-1.5 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground'
                  }
                >
                  {counts[tab.key]}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Empty states */}
      {visibleClaims.length === 0 && (
        <div className="card card-body text-center py-12">
          {currentTab === 'active' && (
            <>
              <p className="text-muted-foreground">No active gigs right now.</p>
              <Link href="/gigs" className="text-accent text-sm hover:underline mt-2 inline-block">
                Browse available gigs →
              </Link>
            </>
          )}
          {currentTab === 'applications' && (
            <>
              <p className="text-muted-foreground">You haven&apos;t applied to any gigs yet.</p>
              <Link href="/gigs" className="text-accent text-sm hover:underline mt-2 inline-block">
                Browse gigs →
              </Link>
            </>
          )}
          {currentTab === 'history' && (
            <p className="text-muted-foreground">No past gigs yet.</p>
          )}
        </div>
      )}

      {/* Active tab — clickable cards into the work view */}
      {currentTab === 'active' && visibleClaims.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleClaims.map((claim: { id: string; status: string; claimed_at: string; gigs: unknown }) => {
            const gig = claim.gigs as {
              title: string
              furniture_type: string
              location_text: string | null
              due_date: string | null
              pay_amount: number
            } | null
            if (!gig) return null
            return (
              <Link
                key={claim.id}
                href={`/my-gigs/${claim.id}`}
                className="card hover:shadow-md transition-shadow group block"
              >
                <div className="card-body space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-sans font-semibold text-foreground group-hover:text-accent transition-colors">
                        {gig.title}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono capitalize mt-0.5">
                        {gig.furniture_type}
                      </p>
                    </div>
                    <span
                      className={claimStatusClass(
                        claim.status as
                          | 'pending'
                          | 'active'
                          | 'submitted_for_review'
                          | 'approved'
                          | 'rejected'
                          | 'cancelled'
                      )}
                    >
                      {claimStatusLabel(
                        claim.status as
                          | 'pending'
                          | 'active'
                          | 'submitted_for_review'
                          | 'approved'
                          | 'rejected'
                          | 'cancelled'
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {gig.location_text && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {gig.location_text}
                      </span>
                    )}
                    {gig.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Due {formatDate(gig.due_date)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="font-mono font-semibold text-sm text-foreground">
                      {formatCurrency(gig.pay_amount)}
                    </span>
                    <span className="text-xs text-accent flex items-center gap-1 group-hover:gap-1.5 transition-all">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Applications tab — pending applications waiting on a flipper */}
      {currentTab === 'applications' && visibleClaims.length > 0 && (
        <div className="space-y-3">
          {visibleClaims.map(
            (claim: { id: string; status: string; claimed_at: string; gig_id: string; gigs: unknown }) => {
              const gig = claim.gigs as {
                title: string
                slug: string
                furniture_type: string
                location_text: string | null
                due_date: string | null
                pay_amount: number
              } | null
              if (!gig) return null
              return (
                <div key={claim.id} className="card card-body space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/gigs/${gig.slug}`}
                        className="font-sans font-semibold text-foreground hover:text-accent transition-colors"
                      >
                        {gig.title}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono capitalize mt-0.5">
                        {gig.furniture_type}
                      </p>
                    </div>
                    <span className="status-draft">Pending</span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {gig.location_text && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {gig.location_text}
                      </span>
                    )}
                    {gig.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Due {formatDate(gig.due_date)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="font-mono font-semibold text-sm text-foreground">
                      {formatCurrency(gig.pay_amount)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Applied {formatDate(claim.claimed_at)}
                    </p>
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}

      {/* History tab */}
      {currentTab === 'history' && visibleClaims.length > 0 && (
        <div className="grid gap-3">
          {visibleClaims.map(
            (claim: { id: string; status: string; claimed_at: string; gigs: unknown }) => {
              const gig = claim.gigs as { title: string; pay_amount: number } | null
              if (!gig) return null
              return (
                <div key={claim.id} className="card card-body flex items-center justify-between gap-4">
                  <div>
                    <p className="font-sans font-medium text-foreground">{gig.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(claim.claimed_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {formatCurrency(gig.pay_amount)}
                    </span>
                    <span
                      className={claimStatusClass(
                        claim.status as
                          | 'pending'
                          | 'active'
                          | 'submitted_for_review'
                          | 'approved'
                          | 'rejected'
                          | 'cancelled'
                      )}
                    >
                      {claimStatusLabel(
                        claim.status as
                          | 'pending'
                          | 'active'
                          | 'submitted_for_review'
                          | 'approved'
                          | 'rejected'
                          | 'cancelled'
                      )}
                    </span>
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}
