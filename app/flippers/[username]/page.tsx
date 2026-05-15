import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Globe, ArrowRight, Briefcase, ArrowLeft, Armchair, CheckCircle2 } from 'lucide-react'

export default async function PublicFlipperProfilePage({ params }: { params: { username: string } }) {
  const supabase = createClient()

  // Load flipper profile by username
  const { data: profile } = await supabase
    .from('flipper_profiles')
    .select('*, users(id)')
    .eq('username', params.username)
    .eq('profile_public', true)
    .single()

  if (!profile) notFound()

  const userId = (profile.users as { id: string } | null)?.id

  // Load their active open gigs
  const { data: gigs } = userId
    ? await supabase
        .from('gigs')
        .select('*')
        .eq('poster_user_id', userId)
        .in('status', ['open'])
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  // Count completed gigs
  const { count: completedCount } = userId
    ? await supabase
        .from('gigs')
        .select('*', { count: 'exact', head: true })
        .eq('poster_user_id', userId)
        .eq('status', 'completed')
    : { count: 0 }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple top bar */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl text-foreground hover:text-accent transition-colors">
            <Armchair className="w-5 h-5 text-accent" strokeWidth={1.5} />
            FlipWork
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm px-3 py-1.5 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
            >
              Join FlipWork
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Profile header */}
        <div className="card card-body">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.business_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-serif text-muted-foreground">
                  {profile.business_name?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h1 className="text-2xl text-foreground">{profile.business_name}</h1>
                <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                {profile.city && profile.state && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {profile.city}, {profile.state}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-accent transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Website
                  </a>
                )}
                <span className="flex items-center gap-1.5 text-green-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {completedCount ?? 0} gig{completedCount !== 1 ? 's' : ''} completed
                </span>
              </div>

              {profile.bio && (
                <p className="text-muted-foreground text-sm">{profile.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Open gigs */}
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-accent" />
            Open Gigs
            {gigs && gigs.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-1">({gigs.length})</span>
            )}
          </h2>

          {!gigs || gigs.length === 0 ? (
            <div className="card card-body text-center py-10">
              <p className="text-muted-foreground text-sm">No open gigs right now. Check back soon!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {gigs.map((gig) => (
                <Link
                  key={gig.id}
                  href={`/gigs/${gig.slug}`}
                  className="card hover:shadow-md transition-shadow group block"
                >
                  <div className="card-body space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors text-sm leading-snug">
                          {gig.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono capitalize">
                          {gig.furniture_type}
                        </p>
                      </div>
                      <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
                    </div>

                    {gig.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{gig.summary}</p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {(gig.city || gig.location_text) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {gig.city && gig.state ? `${gig.city}, ${gig.state}` : gig.location_text}
                          </span>
                        )}
                        {gig.due_date && (
                          <span>Due {formatDate(gig.due_date)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-accent">
                        <span className="font-mono font-semibold">{formatCurrency(gig.pay_amount)}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* CTA for workers */}
        <div className="card card-body text-center space-y-3 bg-secondary/50">
          <p className="text-foreground font-medium">Looking for furniture flipping work?</p>
          <p className="text-sm text-muted-foreground">
            Sign up as a worker to claim gigs from {profile.business_name} and others in your area.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm"
          >
            Find Gigs Near You
          </Link>
        </div>
      </main>
    </div>
  )
}
