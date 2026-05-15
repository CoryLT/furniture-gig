import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, Wrench, ArrowLeft, User, Pencil } from 'lucide-react'

export default async function FlipperGigDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: gig } = await supabase
    .from('gigs')
    .select('*')
    .eq('id', params.id)
    .eq('poster_user_id', user!.id)
    .single()

  if (!gig) notFound()

  // Load claims with worker info
  const { data: claims } = await supabase
    .from('gig_claims')
    .select('*, worker_profiles(first_name, last_name, city, state, username, bio, skills)')
    .eq('gig_id', gig.id)
    .order('claimed_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/flipper/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
        <Link
          href={`/flipper/gigs/${gig.id}/edit`}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit gig
        </Link>
      </div>

      {/* Gig header */}
      <div className="card card-body space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl text-foreground">{gig.title}</h1>
            <p className="text-sm text-muted-foreground font-mono capitalize mt-0.5">{gig.furniture_type}</p>
          </div>
          <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          {(gig.city || gig.location_text) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {gig.city && gig.state ? `${gig.city}, ${gig.state}` : gig.location_text}
            </span>
          )}
          {gig.due_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Due {formatDate(gig.due_date)}
            </span>
          )}
          {gig.required_skills.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Wrench className="w-4 h-4" />
              {gig.required_skills.join(', ')}
            </span>
          )}
        </div>

        <div className="font-mono text-xl font-semibold text-foreground">
          {formatCurrency(gig.pay_amount)}
        </div>

        {gig.summary && <p className="text-muted-foreground">{gig.summary}</p>}
        {gig.description && (
          <div className="prose prose-sm max-w-none text-muted-foreground border-t border-border pt-4">
            <p className="whitespace-pre-wrap">{gig.description}</p>
          </div>
        )}
      </div>

      {/* Claims */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {claims?.length ?? 0} {claims?.length === 1 ? 'Claim' : 'Claims'}
        </h2>

        {!claims || claims.length === 0 ? (
          <div className="card card-body text-center py-12">
            <p className="text-muted-foreground">No workers have claimed this gig yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => {
              const wp = claim.worker_profiles as {
                first_name: string; last_name: string; city: string;
                state: string; username: string | null; bio: string; skills: string[]
              } | null

              return (
                <div key={claim.id} className="card card-body space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {wp ? `${wp.first_name} ${wp.last_name}` : 'Worker'}
                        </p>
                        {wp?.city && wp?.state && (
                          <p className="text-xs text-muted-foreground">{wp.city}, {wp.state}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-badge ${
                        claim.status === 'active' ? 'status-open' :
                        claim.status === 'submitted_for_review' ? 'status-in-review' :
                        claim.status === 'approved' ? 'status-completed' : 'status-draft'
                      }`}>
                        {claim.status.replace(/_/g, ' ')}
                      </span>
                      {wp?.username && (
                        <Link
                          href={`/workers/${wp.username}`}
                          className="text-xs text-accent hover:underline"
                          target="_blank"
                        >
                          View profile
                        </Link>
                      )}
                    </div>
                  </div>

                  {wp?.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{wp.bio}</p>
                  )}

                  {wp?.skills && wp.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {wp.skills.map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Claimed {formatDate(claim.claimed_at)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
