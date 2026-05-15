import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, Wrench, ArrowRight, AlertCircle } from 'lucide-react'

export default async function GigsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Load the worker's profile to get their city/state for filtering
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('city, state')
    .eq('user_id', user!.id)
    .single()

  const workerCity = workerProfile?.city?.trim() ?? ''
  const workerState = workerProfile?.state?.trim() ?? ''
  const hasLocation = workerCity.length > 0 && workerState.length > 0

  // Build gig query — filter by worker location if available
  let query = supabase
    .from('gigs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (hasLocation) {
    query = query
      .ilike('city', workerCity)
      .eq('state', workerState)
  }

  const { data: gigs } = await query

  // Load first image for each gig (thumbnail)
  let gigsWithImages: any[] = []
  if (gigs) {
    for (const gig of gigs) {
      const { data: images } = await supabase
        .from('gig_images')
        .select('*')
        .eq('gig_id', gig.id)
        .order('sort_order')
        .limit(1)

      const image = images?.[0]
      const imageUrl = image
        ? supabase.storage.from('gig-images').getPublicUrl(image.file_path).data.publicUrl
        : null

      gigsWithImages.push({
        ...gig,
        thumbnailUrl: imageUrl,
      })
    }
  }

  // Load any claims this worker has so we can show "claimed by you" on cards
  const { data: myClaims } = await supabase
    .from('gig_claims')
    .select('gig_id')
    .eq('worker_user_id', user!.id)

  const myClaimedIds = new Set(myClaims?.map((c) => c.gig_id) ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Available Gigs</h1>
          <p className="text-muted-foreground mt-1">
            {hasLocation
              ? `${gigsWithImages?.length ?? 0} open ${gigsWithImages?.length === 1 ? 'gig' : 'gigs'} in ${workerCity}, ${workerState}`
              : `${gigsWithImages?.length ?? 0} open ${gigsWithImages?.length === 1 ? 'gig' : 'gigs'}`
            }
          </p>
        </div>
      </div>

      {/* No location set banner */}
      {!hasLocation && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Your profile doesn&apos;t have a city and state set yet, so you&apos;re seeing all gigs.{' '}
            <Link href="/auth/onboarding" className="underline font-medium">Update your profile</Link> to see only local gigs.
          </span>
        </div>
      )}

      {!gigsWithImages || gigsWithImages.length === 0 ? (
        <div className="card card-body text-center py-16 space-y-2">
          <p className="text-lg text-muted-foreground">No gigs available in your area right now.</p>
          <p className="text-sm text-muted-foreground">Check back soon — new projects get posted regularly.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigsWithImages.map((gig) => (
            <Link
              key={gig.id}
              href={`/gigs/${gig.slug}`}
              className="card hover:shadow-md transition-shadow group block overflow-hidden"
            >
              {/* Thumbnail image */}
              {gig.thumbnailUrl && (
                <div className="w-full h-40 bg-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gig.thumbnailUrl}
                    alt={gig.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              )}
              <div className="card-body space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-sans font-semibold text-base text-foreground group-hover:text-accent transition-colors leading-snug">
                      {gig.title}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono capitalize">
                      {gig.furniture_type}
                    </p>
                  </div>
                  <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
                </div>

                {/* Summary */}
                {gig.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{gig.summary}</p>
                )}

                {/* Meta */}
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {(gig.city || gig.location_text) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {gig.city && gig.state ? `${gig.city}, ${gig.state}` : gig.location_text}
                    </div>
                  )}
                  {gig.due_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      Due {formatDate(gig.due_date)}
                    </div>
                  )}
                  {gig.required_skills.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      {gig.required_skills.join(', ')}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(gig.pay_amount)}
                  </span>
                  <span className="text-xs text-accent flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    {myClaimedIds.has(gig.id) ? 'View your claim' : 'View gig'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
