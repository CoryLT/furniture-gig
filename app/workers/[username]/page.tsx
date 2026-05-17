'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Nav from '@/components/shared/Nav'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function PublicWorkerProfilePage() {
  const params = useParams()
  const username = params.username as string
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [username])

  async function loadProfile() {
    setLoading(true)

    // Get the currently logged-in user
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    // Load the profile for the username in the URL
    const { data: profileData } = await supabase
      .from('worker_profiles')
      .select('*')
      .eq('username', username)
      .single()

    if (profileData) {
      setProfile(profileData)
      // Check if this is the current user's own profile
      if (user && user.id === profileData.user_id) {
        setIsOwnProfile(true)
      }
    }

    setLoading(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Nav role="worker" userName={currentUser?.user_metadata?.name} userUsername={username} />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/gigs" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to gigs
          </Link>
          <p className="text-center text-muted-foreground">Worker not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {currentUser && <Nav role="worker" userName={currentUser?.user_metadata?.name} userUsername={currentUser?.user_metadata?.username} />}
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/gigs" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to gigs
        </Link>

        <div className="space-y-6">
          <div className="card">
            <div className="card-body space-y-6">
              {/* Avatar */}
              {profile.avatar_url && (
                <div className="flex justify-center">
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-stone-200">
                    <Image
                      src={profile.avatar_url}
                      alt={profile.first_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Profile Info */}
              <div className="text-center">
                <h1 className="text-3xl font-serif text-foreground">
                  {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-muted-foreground mt-2">@{profile.username}</p>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-foreground text-center">{profile.bio}</p>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <h3 className="font-medium text-foreground mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.skills.map((skill: string) => (
                      <span key={skill} className="inline-flex text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              {(profile.city || profile.state) && (
                <div className="text-center text-muted-foreground">
                  {profile.city && profile.state && `${profile.city}, ${profile.state}`}
                  {profile.city && !profile.state && profile.city}
                  {!profile.city && profile.state && profile.state}
                </div>
              )}

              {/* Edit link - only show if it's their own profile */}
              {isOwnProfile && (
                <div className="pt-4 border-t border-stone-200">
                  <Link href="/profile/worker" className="text-sm text-accent hover:underline text-center block">
                    Edit your profile
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}