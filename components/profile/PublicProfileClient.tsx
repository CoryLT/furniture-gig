'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  MapPin,
  Globe,
  Armchair,
  CheckCircle2,
  User,
  Wrench,
  Image as ImageIcon,
  Briefcase,
  Calendar,
  ArrowRight,
  Tag,
  ShoppingBag,
} from 'lucide-react'
import { type GalleryPhoto } from '@/components/ui/PhotoGallery'
import Nav from '@/components/shared/Nav'
import { FoundingMemberBadge } from '@/components/shared/FoundingMemberBadge'
import { VerifiedBadge } from '@/components/shared/VerifiedBadge'
import { FollowButton } from '@/components/profile/FollowButton'
import ContactButton from '@/components/shared/ContactButton'
import { formatCurrency, formatDate, formatPriceFromCents } from '@/lib/utils'

interface MergedProfile {
  user_id: string
  username: string
  fullName: string
  avatarUrl: string
  city: string
  state: string
  businessName: string
  bio: string
  website: string
  skills: string[]
  isFoundingMember?: boolean
  isVerified?: boolean
}

interface ProfileService {
  id: string
  blurb: string
  price_type: 'flat' | 'hourly' | 'starting_at' | 'contact_for_quote'
  price_amount: number | null
  categoryLabel: string
}

interface PublicProfileClientProps {
  profile: MergedProfile
  openGigs: any[]
  gigThumbnails: Record<string, string>
  listings: any[]
  listingThumbnails: Record<string, string>
  services: ProfileService[]
  confirmedPaidCount: number
  memberSince: string | null
  workerPhotos: any[]
  flipperPhotos: any[]
  viewerUserId: string | null
  viewerIsFollowing: boolean
  ownFollowerCount: number | null
}

export function PublicProfileClient({
  profile,
  openGigs,
  gigThumbnails,
  listings,
  listingThumbnails,
  services,
  confirmedPaidCount,
  memberSince,
  workerPhotos: initialWorkerPhotos,
  flipperPhotos: initialFlipperPhotos,
  viewerUserId,
  viewerIsFollowing,
  ownFollowerCount,
}: PublicProfileClientProps) {
  const supabase = createClient()

  const [workerPhotos, setWorkerPhotos] = useState<GalleryPhoto[]>([])
  const [flipperPhotos, setFlipperPhotos] = useState<GalleryPhoto[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(viewerUserId)
  const [loadingUser, setLoadingUser] = useState(viewerUserId === null)

  useEffect(() => {
    // Build public URLs for both photo sets
    const workerWithUrls = initialWorkerPhotos.map((p) => ({
      ...p,
      publicUrl: supabase.storage.from('photo-galleries').getPublicUrl(p.file_path).data.publicUrl,
    }))
    setWorkerPhotos(workerWithUrls)

    const flipperWithUrls = initialFlipperPhotos.map((p) => ({
      ...p,
      publicUrl: supabase.storage.from('photo-galleries').getPublicUrl(p.file_path).data.publicUrl,
    }))
    setFlipperPhotos(flipperWithUrls)
  }, [initialWorkerPhotos, initialFlipperPhotos, supabase.storage])

  // Check if the viewer is logged in (controls top nav vs marketing header)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
      setLoadingUser(false)
    })
  }, [supabase])

  const isOwnProfile = currentUserId && currentUserId === profile.user_id
  const isLoggedIn = !!currentUserId

  // What to display as the main heading
  const primaryName = profile.fullName || profile.businessName || `@${profile.username}`
  const secondaryName =
    profile.businessName && profile.fullName && profile.businessName !== profile.fullName
      ? profile.businessName
      : ''

  const hasLocation = profile.city || profile.state
  const locationText = [profile.city, profile.state].filter(Boolean).join(', ')

  const allPhotos = [...workerPhotos, ...flipperPhotos]
  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — logged-in users see the app Nav, logged-out users see a marketing header */}
      {isLoggedIn ? (
        <Nav role="worker" />
      ) : (
        <header className="border-b border-border bg-card">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 font-serif text-xl text-foreground hover:text-accent transition-colors"
            >
              <Armchair className="w-5 h-5 text-accent" strokeWidth={1.5} />
              FlipWork
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
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
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero card */}
        <div className="card">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-muted flex-shrink-0 mx-auto sm:mx-0">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={primaryName}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 space-y-3 min-w-0 text-center sm:text-left">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-serif text-foreground inline-flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <span>{primaryName}</span>
                    {profile.isVerified && <VerifiedBadge size="lg" />}
                  </h1>
                  {secondaryName && (
                    <p className="text-base text-muted-foreground mt-1">{secondaryName}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
                  {(profile.isFoundingMember) && (
                    <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                      <FoundingMemberBadge size="md" />
                    </div>
                  )}
                </div>

                {/* Meta line */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-sm">
                  {hasLocation && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {locationText}
                    </span>
                  )}
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-accent hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                      Website
                    </a>
                  )}
                </div>

                {/* Edit button if it's your own profile, otherwise Follow button */}
                {isOwnProfile ? (
                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                    >
                      Edit your profile
                    </Link>
                    {ownFollowerCount !== null && (
                      <Link
                        href="/connections"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        title="Only you can see this"
                      >
                        <span className="font-semibold text-foreground">
                          {ownFollowerCount}
                        </span>
                        {ownFollowerCount === 1 ? 'follower' : 'followers'}
                      </Link>
                    )}
                  </div>
                ) : (
                  isLoggedIn && (
                    <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                      <FollowButton
                        followedUserId={profile.user_id}
                        initialFollowing={viewerIsFollowing}
                      />
                      <div className="w-auto">
                        <ContactButton otherUserId={profile.user_id} />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile stat cards shelved 2026-06-17 — TBD what to feature here.
            confirmedPaidCount + memberSince are still passed in and ready to
            drop back in once we decide. */}

        {/* About */}
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-serif text-foreground mb-3">About</h2>
            {profile.bio ? (
              <p className="text-foreground whitespace-pre-line leading-relaxed">{profile.bio}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {isOwnProfile
                  ? "You haven't added a bio yet. Click Edit your profile to add one."
                  : `${primaryName} hasn't added a bio yet.`}
              </p>
            )}
          </div>
        </div>

        {/* Skills */}
        {profile.skills.length > 0 && (
          <div className="card">
            <div className="card-body">
              <h2 className="text-lg font-serif text-foreground mb-3 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-accent" strokeWidth={1.5} />
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex text-sm px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Available gigs — what this person currently has open for workers.
            We hide the whole section from strangers when there are none; the
            owner sees an empty state that prompts them to post one. */}
        {(openGigs.length > 0 || isOwnProfile) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-serif text-foreground flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent" strokeWidth={1.5} />
                Available gigs
                {openGigs.length > 0 && (
                  <span className="text-base font-sans text-muted-foreground font-normal">
                    ({openGigs.length})
                  </span>
                )}
              </h2>
              {/* Post a gig shelved (operator-only direction). Reversible.
              {isOwnProfile && (
                <Link
                  href="/flipper/post-gig"
                  className="text-sm text-accent hover:underline"
                >
                  + Post a gig
                </Link>
              )} */}
            </div>

            {openGigs.length > 0 ? (
              <div className="space-y-2">
                {openGigs.map((gig: any) => {
                  const thumb = gigThumbnails[gig.id]
                  const gigLocation =
                    gig.city && gig.state
                      ? `${gig.city}, ${gig.state}`
                      : gig.location_text || ''
                  return (
                    <Link
                      key={gig.id}
                      href={`/gigs/${gig.slug}`}
                      className="card hover:shadow-md transition-shadow group block"
                    >
                      <div className="card-body">
                        <div className="flex items-start gap-3">
                          {/* Thumbnail or placeholder */}
                          <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Armchair className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>

                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1">
                              {gig.title}
                            </h3>
                            {gig.summary && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                {gig.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                              {gigLocation && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {gigLocation}
                                </span>
                              )}
                              {gig.due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Due {formatDate(gig.due_date)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Pay + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-semibold text-foreground">
                              {formatCurrency(gig.pay_amount)}
                            </span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {/* If we capped at 10 and there are exactly 10 shown, hint
                    that more might exist via the gigs page. We can't tell
                    from here if there are >10 — keeping it simple. */}
                {openGigs.length >= 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Showing the 10 most recent open gigs.
                  </p>
                )}
              </div>
            ) : (
              /* Owner-only empty state */
              <div className="card">
                <div className="card-body text-center py-10">
                  <Briefcase className="w-10 h-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground mb-4">
                    You don&apos;t have any open gigs right now.
                  </p>
                  <Link
                    href="/flipper/post-gig"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm"
                  >
                    Post a gig
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Services offered — what this person can be hired to do.
            Shown to everyone when there are services; the owner sees an
            empty-state nudge to add some. */}
        {(services.length > 0 || isOwnProfile) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-serif text-foreground flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent" strokeWidth={1.5} />
                Services offered
                {services.length > 0 && (
                  <span className="text-base font-sans text-muted-foreground font-normal">
                    ({services.length})
                  </span>
                )}
              </h2>
              {isOwnProfile && (
                <Link
                  href="/profile/worker/services"
                  className="text-sm text-accent hover:underline"
                >
                  + Manage services
                </Link>
              )}
            </div>

            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((svc) => {
                  let priceLabel = 'Contact for quote'
                  const amt =
                    svc.price_amount != null
                      ? `$${Number(svc.price_amount).toFixed(2)}`
                      : ''
                  if (svc.price_type === 'flat') priceLabel = amt ? `${amt} flat` : 'Flat rate'
                  else if (svc.price_type === 'hourly') priceLabel = amt ? `${amt}/hr` : 'Hourly'
                  else if (svc.price_type === 'starting_at') priceLabel = amt ? `Starting at ${amt}` : 'Starting at'
                  return (
                    <div
                      key={svc.id}
                      className="p-4 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {svc.categoryLabel}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {priceLabel}
                        </span>
                      </div>
                      {svc.blurb && (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                          {svc.blurb}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 border border-dashed border-border rounded-lg text-center text-muted-foreground">
                You haven&apos;t added any services yet.{' '}
                <Link
                  href="/profile/worker/services"
                  className="text-accent hover:underline"
                >
                  Add your first one.
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Work Samples — Instagram-style grid */}
        <div className="space-y-4">
          <h2 className="text-2xl font-serif text-foreground">Work Samples</h2>
          {allPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {allPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden bg-muted group"
                >
                  <Image
                    src={photo.publicUrl}
                    alt="Work sample"
                    fill
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, 25vw"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="card-body text-center py-12">
                <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  {isOwnProfile
                    ? "No photos yet. Add work samples from your profile editor to showcase what you do."
                    : `${primaryName} hasn't added any work samples yet.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CTA — only for logged-out visitors */}
        {!loadingUser && !isLoggedIn && (
          <div className="card card-body text-center space-y-3 bg-secondary/50">
            <p className="text-foreground font-medium">Looking for skilled help nearby?</p>
            <p className="text-sm text-muted-foreground">
              Sign up to claim gigs from {primaryName} and others in your area.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm"
            >
              Find Gigs Near You
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
