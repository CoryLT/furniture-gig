import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { Plus, MapPin, Calendar, Users, ArrowRight, DollarSign, Briefcase, Clock } from 'lucide-react'

export default async function FlipperDashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Load flipper's gigs
  const { data: gigs } = await supabase
    .from('gigs')
    .select('*')
    .eq('poster_user_id', user!.id)
    .order('created_at', { ascending: false })

  // Load claim counts per gig
  const gigIds = gigs?.map((g) => g.id) ?? []
  const { data: claims } = gigIds.length > 0
    ? await supabase
        .from('gig_claims')
        .select('gig_id, status')
        .in('gig_id', gigIds)
    : { data: [] }

  const claimsByGig = (claims ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.gig_id] = (acc[c.gig_id] ?? 0) + 1
    return acc
  }, {})

  // Stats
  const totalGigs = gigs?.length ?? 0
  const activeGigs = gigs?.filter((g) => ['open', 'claimed', 'in_review'].includes(g.status)).length ?? 0
  const completedGigs = gigs?.filter((g) => g.status === 'completed').length ?? 0
  const totalPayout = gigs
    ?.filter((g) => g.status === 'completed')
    .reduce((sum, g) => sum + Number(g.pay_amount), 0) ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your furniture flipping gigs</p>
        </div>
        <Link
          href="/flipper/post-gig"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Post a Gig
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-body">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">{totalGigs}</p>
              <p className="text-xs text-muted-foreground">Total Gigs</p>
            </div>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">{activeGigs}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">{completedGigs}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>
        <div className="card card-body">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-mono font-semibold text-foreground">{formatCurrency(totalPayout)}</p>
              <p className="text-xs text-muted-foreground">Paid Out</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gig list */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Gigs</h2>

        {!gigs || gigs.length === 0 ? (
          <div className="card card-body text-center py-16 space-y-3">
            <p className="text-lg text-muted-foreground">You haven&apos;t posted any gigs yet.</p>
            <p className="text-sm text-muted-foreground">Post your first gig to find local workers.</p>
            <Link
              href="/flipper/post-gig"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              Post your first gig
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {gigs.map((gig) => (
              <Link
                key={gig.id}
                href={`/flipper/gigs/${gig.id}`}
                className="card hover:shadow-md transition-shadow group block"
              >
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                          {gig.title}
                        </h3>
                        <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {(gig.city || gig.location_text) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {gig.city && gig.state ? `${gig.city}, ${gig.state}` : gig.location_text}
                          </span>
                        )}
                        {gig.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Due {formatDate(gig.due_date)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {claimsByGig[gig.id] ?? 0} {claimsByGig[gig.id] === 1 ? 'claim' : 'claims'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(gig.pay_amount)}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
