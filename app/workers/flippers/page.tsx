import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface FlipperProfilePageProps {
  params: Promise<{ username: string }>
}

export default async function FlipperProfilePage({ params }: FlipperProfilePageProps) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('flipper_profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) {
    notFound()
  }

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
                      alt={profile.business_name || profile.username}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Name */}
                <div>
                  <h1 className="text-2xl font-serif text-foreground">
                    {profile.business_name || profile.username}
                  </h1>
                  <p className="text-muted-foreground text-sm">@{profile.username}</p>
                </div>

                {/* Location */}
                {(profile.city || profile.state) && (
                  <div className="text-sm text-muted-foreground">
                    {profile.city && profile.state ? `${profile.city}, ${profile.state}` : profile.city || profile.state}
                  </div>
                )}

                {/* Website */}
                {profile.website && (
                  
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-accent hover:underline"
                  >
                    Visit website →
                  </a>
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

            {/* Gallery placeholder */}
            <div className="card">
              <div className="card-body">
                <h2 className="text-lg font-serif text-foreground mb-4">Gallery</h2>
                <div className="text-center py-8 text-muted-foreground">
                  <p>Gallery coming soon in Phase B</p>
                </div>
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