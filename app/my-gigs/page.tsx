import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, claimStatusClass, claimStatusLabel, gigStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, ArrowRight } from 'lucide-react'

export default async function MyGigsPage() {
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

  const active = claims?.filter((c) => ['active', 'submitted_for_review'].includes(c.status)) ?? []
  const history = claims?.filter((c) => ['approved', 'rejected', 'cancelled'].includes(c.status)) ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">My Gigs</h1>
        <p className="text-muted-foreground mt-1">Your claimed and completed gigs.</p>
      </div>

      {/* Active */}
      <section className="space-y-4">
        <h2 className="font-sans font-semibold text-lg text-foreground">Active</h2>
        {active.length === 0 ? (
          <div className="card card-body text-center py-10">
            <p className="text-muted-foreground">No active gigs.</p>
            <Link href="/gigs" className="text-accent text-sm hover:underline mt-2 inline-block">
              Browse available gigs →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((claim) => {
              const gig = claim.gigs as any
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
                      <span className={claimStatusClass(claim.status)}>
                        {claimStatusLabel(claim.status)}
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
      </section>

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-sans font-semibold text-lg text-foreground">History</h2>
          <div className="grid gap-3">
            {history.map((claim) => {
              const gig = claim.gigs as any
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
                    <span className={claimStatusClass(claim.status)}>
                      {claimStatusLabel(claim.status)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
