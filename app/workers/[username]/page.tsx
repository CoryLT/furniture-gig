import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Wrench, CheckCircle2, ImageIcon, ArrowLeft, Armchair } from 'lucide-react'

export default async function PublicWorkerProfilePage({ params }: { params: { username: string } }) {
  const supabase = createClient()

  // Load worker profile by username
  const { data: profile } = await supabase
    .from('worker_profiles')
    .select('*, users(id)')
    .eq('username', params.username)
    .eq('profile_public', true)
    .single()

  if (!profile) notFound()

  const userId = (profile.users as { id: string } | null)?.id

  // Count completed gigs
  const { count: completedCount } = userId
    ? await supabase
        .from('gig_claims')
        .select('*', { count: 'exact', head: true })
        .eq('worker_user_id', userId)
        .eq('status', 'approved')
    : { count: 0 }

  // Load portfolio photos (from completed/approved gigs)
  const { data: photos } = userId
    ? await supabase
        .from('gig_photo_uploads')
        .select('file_path, caption, gig_id')
        .eq('worker_user_id', userId)
        .limit(12)
    : { data: [] }

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
                <img src={profile.avatar_url} alt={profile.first_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-serif text-muted-foreground">
                  {profile.first_name?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h1 className="text-2xl text-foreground">
                  {profile.first_name} {profile.last_name?.[0] ? `${profile.last_name[0]}.` : ''}
                </h1>
                <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                {profile.city && profile.state && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {profile.city}, {profile.state}
                  </span>
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

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="card card-body space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-accent" />
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill: string) => (
                <span
                  key={skill}
                  className="text-sm px-3 py-1 rounded-full bg-secondary text-foreground border border-border"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio photos */}
        {photos && photos.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-accent" />
              Portfolio
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.file_path}
                  className="aspect-square rounded-lg bg-secondary overflow-hidden border border-border"
                >
                  {/* Photos are stored in private bucket — we'd need signed URLs in a real implementation */}
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No portfolio */}
        {(!photos || photos.length === 0) && (completedCount ?? 0) === 0 && (
          <div className="card card-body text-center py-10">
            <p className="text-muted-foreground text-sm">This worker is just getting started on FlipWork.</p>
          </div>
        )}

        {/* CTA */}
        <div className="card card-body text-center space-y-3 bg-secondary/50">
          <p className="text-foreground font-medium">Have furniture that needs work?</p>
          <p className="text-sm text-muted-foreground">Post a gig on FlipWork and find skilled local workers like {profile.first_name}.</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm"
          >
            Post a Gig
          </Link>
        </div>
      </main>
    </div>
  )
}
