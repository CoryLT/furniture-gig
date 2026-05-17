'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PhotoGallery, type GalleryPhoto } from '@/components/ui/PhotoGallery'
import { WorkerProfileRow } from '@/types/database'
import { useEffect, useState } from 'react'

interface PublicWorkerProfileClientProps {
  profile: WorkerProfileRow
  photos: any[]
}

export function PublicWorkerProfileClient({
  profile,
  photos: initialPhotos,
}: PublicWorkerProfileClientProps) {
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/gigs" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to gigs
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="card">
              <div className="card-body space-y-4">
                {/* Avatar */}
                {profile.avatar_url && (
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-stone-200">
                    <Image
                      src={profile.avatar_url}
                      alt={`${profile.first_name} ${profile.last_name}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Name */}
                <div>
                  <h1 className="text-2xl font-serif text-foreground">
                    {profile.first_name} {profile.last_name}
                  </h1>
                  <p className="text-muted-foreground text-sm">@{profile.username}</p>
                </div>

                {/* Location */}
                {(profile.city || profile.state) && (
                  <div className="text-sm text-muted-foreground">
                    {profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state}
                  </div>
                )}

                {/* Skills */}
                {profile.skills && profile.skills.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-foreground mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill: string) => (
                        <span key={skill} className="inline-block text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Bio */}
            {profile.bio && (
              <div className="card">
                <div className="card-body">
                  <h2 className="text-lg font-serif text-foreground mb-2">About</h2>
                  <p className="text-foreground whitespace-pre-line">{profile.bio}</p>
                </div>
              </div>
            )}

            {/* Contact Info (if shared) */}
            {(profile.phone || profile.paypal_email) && (
              <div className="card">
                <div className="card-body">
                  <h2 className="text-lg font-serif text-foreground mb-3">Contact</h2>
                  <div className="space-y-2 text-sm">
                    {profile.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone: </span>
                        <a href={`tel:${profile.phone}`} className="text-accent hover:underline">
                          {profile.phone}
                        </a>
                      </div>
                    )}
                    {profile.paypal_email && (
                      <div>
                        <span className="text-muted-foreground">PayPal: </span>
                        <a href={`mailto:${profile.paypal_email}`} className="text-accent hover:underline">
                          {profile.paypal_email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Work Samples Gallery */}
            <div className="card">
              <div className="card-body">
                <h2 className="text-lg font-serif text-foreground mb-4">Work Samples</h2>
                <PhotoGallery
                  photos={photos}
                  isEditable={false}
                  userType="worker"
                />
              </div>
            </div>

            {/* Feedback placeholder */}
            <div className="card">
              <div className="card-body text-center py-8">
                <p className="text-muted-foreground">Feedback coming soon in Phase C</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
