'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import {
  MapPin,
  Globe,
  ArrowRight,
  ArrowLeft,
  Armchair,
  CheckCircle2,
  Briefcase,
  User,
  Wrench,
  Image as ImageIcon,
} from 'lucide-react'
import { PhotoGallery, type GalleryPhoto } from '@/components/ui/PhotoGallery'
import Nav from '@/components/shared/Nav'

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
}

interface PublicProfileClientProps {
  profile: MergedProfile
  openGigs: any[]
  completedCount: number
  workerPhotos: any[]
  flipperPhotos: any[]
}

export function PublicProfileClient({
  profile,
  openGigs,
  completedCount,
  workerPhotos: initialWorkerPhotos,
  flipperPhotos: initialFlipperPhotos,
}: PublicProfileClientProps) {
  const supabase = createClient()
  const router = useRouter()

  const [workerPhotos, setWorkerPhotos] = useState<GalleryPhoto[]>([])
  const [flipperPhotos, setFlipperPhotos] = useState<GalleryPhoto[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

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
        {/* Back link */}
        <Link
          href={isLoggedIn ? '/gigs' : '/'}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isLoggedIn ? 'Back to gigs' : 'Back'}
        </Link>

        {/* Hero card */}
        <div className="card">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-stone-200 flex-shrink-0 mx-auto sm:mx-0">
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
                    <User className="w-12 h-12 text-slate-400" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 space-y-3 min-w-0 text-center sm:text-left">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-serif text-foreground">{primaryName}</h1>
                  {secondaryName && (
                    <p className="text-base text-muted-foreground mt-1">{secondaryName}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
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

                {/* Edit button if it's your own profile */}
                {isOwnProfile && (
                  <div className="pt-2">
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
                    >
                      Edit your profile
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card">
            <div className="card-body flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold text-foreground leading-none">{openGigs.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Open gigs</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold text-foreground leading-none">{completedCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Completed</p>
              </div>
            </div>
          </div>
          <div className="card col-span-2 sm:col-span-1">
            <div className="card-body flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold text-foreground leading-none">{allPhotos.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Photos</p>
              </div>
            </div>
          </div>
        </div>

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

        {/* Work Samples */}
        {allPhotos.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-foreground">Work Samples</h2>
            <div className="card">
              <div className="card-body">
                <PhotoGallery photos={allPhotos} isEditable={false} userType="flipper" />
              </div>
            </div>
          </div>
        )}

        {/* Open Gigs */}
        {openGigs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-foreground">Open Gigs</h2>
            <div className="space-y-3">
              {openGigs.map((gig: any) => (
                <Link
                  key={gig.id}
                  href={`/gigs/${gig.slug}`}
                  className="card card-body flex-row items-start justify-between hover:bg-secondary/50 transition-colors gap-4"
                >
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{gig.title}</h3>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${gigStatusClass(
                          gig.status
                        )}`}
                      >
                        {gigStatusLabel(gig.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {gig.summary || gig.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      {gig.location_text && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          {gig.location_text}
                        </span>
                      )}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(gig.pay_amount)}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA — only for logged-out visitors */}
        {!loadingUser && !isLoggedIn && (
          <div className="card card-body text-center space-y-3 bg-secondary/50">
            <p className="text-foreground font-medium">Looking for furniture flipping work?</p>
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
