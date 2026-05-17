'use client'

import Link from 'next/link'
import { formatCurrency, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Globe, ArrowRight, ArrowLeft, Armchair } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PhotoGallery, type GalleryPhoto } from '@/components/ui/PhotoGallery'
import { FlipperProfileRow, GigRow } from '@/types/database'
import { useEffect, useState } from 'react'

interface PublicFlipperProfileClientProps {
  profile: FlipperProfileRow
  gigs: GigRow[]
  completedCount: number
  photos: any[]
}

export function PublicFlipperProfileClient({
  profile,
  gigs,
  completedCount,
  photos: initialPhotos,
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

        <div className="space-y-2">
          <h1 className="text-4xl font-serif text-foreground">
            {profile.business_name}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {profile.website && (
              <>
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-accent hover:underline">
                  <Globe className="w-4 h-4" />
                  Visit website
                </a>
                •
              </>
            )}
            {completedCount && <span>{completedCount} completed gigs</span>}
          </p>
        </div>

        {profile.bio && (
          <div className="card">
            <div className="card-body">
              <h2 className="text-lg font-serif text-foreground mb-2">About</h2>
              <p className="text-foreground whitespace-pre-line">{profile.bio}</p>
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

        {/* Recent Gigs */}
        {gigs && gigs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-serif text-foreground">Open Gigs</h2>
            <div className="space-y-3">
              {gigs.map((gig: any) => (
                <Link
                  key={gig.id}
                  href={`/gigs/${gig.slug}`}
                  className="card card-body flex-row items-start justify-between hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{gig.title}</h3>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${gigStatusClass(gig.status)}`}>
                        {gigStatusLabel(gig.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {gig.summary || gig.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
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
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

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
