'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatCurrency, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Globe, ArrowRight, ArrowLeft, Armchair, CheckCircle2, Briefcase, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PhotoGallery, type GalleryPhoto } from '@/components/ui/PhotoGallery'
import { FlipperProfileRow, GigRow } from '@/types/database'
import { useEffect, useState } from 'react'

interface PublicFlipperProfileClientProps {
  profile: FlipperProfileRow
  gigs: GigRow[]
  completedCount: number
  photos: any[]
  fullName?: string
}

export function PublicFlipperProfileClient({
  profile,
  gigs,
  completedCount,
  photos: initialPhotos,
  fullName = '',
}: PublicFlipperProfileClientProps) {
  const supabase = createClient()
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])

  useEffect(() => {
    // Convert photos to include public URLs
    const photosWithUrls = initialPhotos.map((photo) => ({
      ...photo,
      publicUrl: supabase.storage
        .from('photo-galleries')
        .getPublicUrl(photo.file_path).data.publicUrl,
    }))
    setPhotos(photosWithUrls)
  }, [initialPhotos, supabase.storage])

  // Decide what name to show as the main heading
  const displayName = profile.business_name || fullName || profile.username || 'FlipWork User'
  const showSubName = profile.business_name && fullName && profile.business_name !== fullName

  const hasLocation = profile.city || profile.state
  const locationText = [profile.city, profile.state].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Hero card with avatar + name */}
        <div className="card">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-stone-200 flex-shrink-0">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
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
              <div className="flex-1 space-y-3 min-w-0">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-serif text-foreground">
                    {displayName}
                  </h1>
                  {showSubName && (
                    <p className="text-base text-muted-foreground mt-1">{fullName}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
                </div>

                {/* Meta line: location + website */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
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
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="card-body flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground leading-none">{gigs?.length || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Open gigs</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground leading-none">{completedCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Completed gigs</p>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        {profile.bio ? (
          <div className="card">
            <div className="card-body">
              <h2 className="text-lg font-serif text-foreground mb-3">About</h2>
              <p className="text-foreground whitespace-pre-line leading-relaxed">{profile.bio}</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <h2 className="text-lg font-serif text-foreground mb-2">About</h2>
              <p className="text-sm text-muted-foreground italic">
                {displayName} hasn't added a bio yet.
              </p>
            </div>
          </div>
        )}

        {/* Work Samples Gallery */}
        {photos.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-foreground">Work Samples</h2>
            <div className="card">
              <div className="card-body">
                <PhotoGallery
                  photos={photos}
                  isEditable={false}
                  userType="flipper"
                />
              </div>
            </div>
          </div>
        )}

        {/* Open Gigs */}
        {gigs && gigs.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-foreground">Open Gigs</h2>
            <div className="space-y-3">
              {gigs.map((gig: any) => (
                <Link
                  key={gig.id}
                  href={`/gigs/${gig.slug}`}
                  className="card card-body flex-row items-start justify-between hover:bg-secondary/50 transition-colors gap-4"
                >
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground">{gig.title}</h3>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${gigStatusClass(gig.status)}`}>
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
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-foreground">Open Gigs</h2>
            <div className="card">
              <div className="card-body text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No open gigs right now. Check back soon.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CTA for workers */}
        <div className="card card-body text-center space-y-3 bg-secondary/50">
          <p className="text-foreground font-medium">Looking for skilled help nearby?</p>
          <p className="text-sm text-muted-foreground">
            Sign up as a worker to claim gigs from {displayName} and others in your area.
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
