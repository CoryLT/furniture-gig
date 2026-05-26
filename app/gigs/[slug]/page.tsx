import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel, getSiteUrl } from '@/lib/utils'
import { MapPin, Calendar, Wrench, DollarSign, Armchair, ArrowRight } from 'lucide-react'
import ClaimButton from './ClaimButton'
import GigReferenceImages from '@/components/shared/GigReferenceImages'
import ShareButton from '@/components/shared/ShareButton'
import type { GigImageRow } from '@/types/database'

interface Props {
  params: { slug: string }
}

export default async function GigDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load gig
  const { data: gig } = await supabase
    .from('gigs')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!gig || !['open', 'claimed', 'in_review', 'completed'].includes(gig.status)) {
    notFound()
  }

  // Load checklist
  const { data: checklist } = await supabase
    .from('gig_checklist_items')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  // Load reference images
  const { data: imagesData } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const images = (imagesData ?? []) as GigImageRow[]

  // Load ALL applications/claims for this gig
  const { data: allClaims } = await supabase
    .from('gig_claims')
    .select('*')
    .eq('gig_id', gig.id)

  const claims = allClaims ?? []
  const myClaim = claims.find((c) => c.worker_user_id === user.id) ?? null
  // "Active" means a worker has been approved and the gig is locked to them
  const activeClaim = claims.find((c) => c.status === 'active') ?? null
  const pendingApplicantCount = claims.filter((c) => c.status === 'pending').length

  const isMyGig = activeClaim?.worker_user_id === user.id
  const isOwnPostedGig = gig.poster_user_id === user.id || gig.created_by === user.id

  // Load worker's Stripe Connect status — required before applying
  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted' as any)
    .eq('user_id', user.id)
    .maybeSingle()

  const wp = (workerProfile as any) ?? {}
  const stripeReady =
    !!wp.stripe_account_id &&
    !!wp.stripe_charges_enabled &&
    !!wp.stripe_payouts_enabled &&
    !!wp.stripe_details_submitted
  const stripeStarted = !!wp.stripe_account_id

  // Pull other OPEN gigs from the same poster so we can show them at
  // the bottom of the page. Skip the current gig, cap at 12, newest first.
  // Only show this section to workers — the poster sees their own gigs
  // on their dashboard.
  const { data: otherGigsRaw } =
    !isOwnPostedGig && gig.poster_user_id
      ? await supabase
          .from('gigs')
          .select('id, slug, title, summary, city, state, location_text, pay_amount, due_date')
          .eq('poster_user_id', gig.poster_user_id)
          .eq('status', 'open')
          .neq('id', gig.id)
          .order('created_at', { ascending: false })
          .limit(12)
      : { data: [] }

  const otherGigs = (otherGigsRaw ?? []) as Array<{
    id: string
    slug: string
    title: string
    summary: string
    city: string
    state: string
    location_text: string
    pay_amount: number
    due_date: string | null
  }>

  // Thumbnails for those other gigs — same one-image-per-gig pattern
  // used on the flipper dashboard.
  const otherGigIds = otherGigs.map((g) => g.id)
  const { data: otherImagesRaw } = otherGigIds.length > 0
    ? await supabase
        .from('gig_images')
        .select('gig_id, file_path, sort_order')
        .in('gig_id', otherGigIds)
        .order('sort_order')
    : { data: [] }

  const otherGigThumbnails: Record<string, string> = {}
  for (const img of (otherImagesRaw ?? []) as { gig_id: string; file_path: string }[]) {
    if (!otherGigThumbnails[img.gig_id]) {
      otherGigThumbnails[img.gig_id] = supabase.storage
        .from('gig-images')
        .getPublicUrl(img.file_path).data.publicUrl
    }
  }

  // Poster's public profile info — name + username for the section
  // header link. We try flipper_profiles first (since posters are
  // flippers), then fall back to worker_profiles for the display name.
  let posterName = ''
  let posterUsername = ''
  if (otherGigs.length > 0 && gig.poster_user_id) {
    const [{ data: posterFp }, { data: posterWp }] = await Promise.all([
      supabase
        .from('flipper_profiles')
        .select('username, business_name')
        .eq('user_id', gig.poster_user_id)
        .maybeSingle(),
      supabase
        .from('worker_profiles')
        .select('first_name, last_name, username')
        .eq('user_id', gig.poster_user_id)
        .maybeSingle(),
    ])
    const fp = (posterFp as any) ?? {}
    const wpRow = (posterWp as any) ?? {}
    posterUsername = fp.username || wpRow.username || ''
    const fullName = [wpRow.first_name, wpRow.last_name].filter(Boolean).join(' ').trim()
    posterName =
      fp.business_name ||
      fullName ||
      (posterUsername ? `@${posterUsername}` : 'this poster')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link + share */}
      <div className="flex items-center justify-between gap-4">
        <a href="/gigs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to gigs
        </a>
        <ShareButton
          url={`${getSiteUrl()}/gigs/${gig.slug}`}
          title={gig.title}
          kind="gig"
        />
      </div>

      {/* Header card */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
                {gig.furniture_type && (
                  <span className="text-xs font-mono text-muted-foreground capitalize">{gig.furniture_type}</span>
                )}
              </div>
              <h1 className="text-2xl text-foreground">{gig.title}</h1>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 text-2xl font-mono font-semibold text-foreground">
                <DollarSign className="w-5 h-5 text-accent" />
                {gig.pay_amount.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">payout</p>
            </div>
          </div>
        </div>
        <div className="card-body space-y-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {gig.location_text && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {gig.location_text}
              </span>
            )}
            {gig.due_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Due {formatDate(gig.due_date)}
              </span>
            )}
          </div>

          {/* Skills */}
          {gig.required_skills.length > 0 && (
            <div className="flex items-start gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {gig.required_skills.map((skill) => (
                  <span key={skill} className="px-2 py-0.5 bg-secondary rounded-full text-xs font-medium text-secondary-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {gig.summary && (
            <p className="text-sm text-muted-foreground">{gig.summary}</p>
          )}

          {/* Description */}
          {gig.description && (
            <div className="prose-sm text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {gig.description}
            </div>
          )}
        </div>
      </div>

      {/* Reference images */}
      <GigReferenceImages images={images} />

      {/* Checklist preview */}
      {checklist && checklist.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-sans font-semibold text-foreground">Checklist ({checklist.length} items)</h2>
          </div>
          <div className="divide-y divide-border">
            {checklist.map((item, i) => (
              <div key={item.id} className="px-6 py-3 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                    {item.required && <span className="text-destructive ml-1">*</span>}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim action */}
      <ClaimButton
        gig={gig}
        myClaim={myClaim}
        isMyGig={isMyGig}
        isOwnPostedGig={isOwnPostedGig}
        hasActiveClaim={!!activeClaim}
        pendingApplicantCount={pendingApplicantCount}
        userId={user.id}
        stripeReady={stripeReady}
        stripeStarted={stripeStarted}
      />

      {/* More gigs from this poster — only renders if there are any,
          and only for non-owners (the poster doesn't need to see their
          own gigs surfaced back to them). Horizontal swipe carousel
          with CSS scroll-snap so it feels native on phones. */}
      {otherGigs.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-sans font-semibold text-foreground">
              More gigs from {posterName}
            </h2>
            {posterUsername && (
              <Link
                href={`/u/${posterUsername}`}
                className="text-sm text-accent hover:underline inline-flex items-center gap-1 shrink-0"
              >
                View profile
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div
            className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin' }}
          >
            {otherGigs.map((other) => {
              const thumb = otherGigThumbnails[other.id]
              const loc =
                other.city && other.state
                  ? `${other.city}, ${other.state}`
                  : other.location_text || ''
              return (
                <Link
                  key={other.id}
                  href={`/gigs/${other.slug}`}
                  className="snap-start shrink-0 w-56 card hover:shadow-md transition-shadow group block"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-t-md bg-muted border-b border-border flex items-center justify-center">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Armchair className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="p-3 space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors min-h-[2.5rem]">
                      {other.title}
                    </h3>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(other.pay_amount)}
                      </span>
                      {loc && (
                        <span className="text-muted-foreground truncate">
                          {loc}
                        </span>
                      )}
                    </div>
                    {other.due_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due {formatDate(other.due_date)}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
