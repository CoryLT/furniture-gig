import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Globe, ArrowRight, Briefcase, ArrowLeft, Armchair, CheckCircle2 } from 'lucide-react'
import { PublicFlipperProfileClient } from '@/components/flipper/PublicFlipperProfileClient'

export default async function PublicFlipperProfilePage({ params }: { params: { username: string } }) {
  const supabase = createClient()

  // Load flipper profile by username
  const { data: profile } = await supabase
    .from('flipper_profiles')
    .select('*, users(id)')
    .eq('username', params.username)
    .eq('profile_public', true)
    .single()

  if (!profile) notFound()

  const userId = (profile.users as { id: string } | null)?.id

  // Load their active open gigs
  const { data: gigs } = userId
    ? await supabase
        .from('gigs')
        .select('*')
        .eq('poster_user_id', userId)
        .in('status', ['open'])
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  // Count completed gigs
  const { count: completedCount } = userId
    ? await supabase
        .from('gigs')
        .select('*', { count: 'exact', head: true })
        .eq('poster_user_id', userId)
        .eq('status', 'completed')
    : { count: 0 }

  // Load gallery photos
  const { data: photos } = userId
    ? await supabase
        .from('flipper_photo_galleries')
        .select('*')
        .eq('flipper_user_id', userId)
        .order('created_at', { ascending: false })
    : { data: [] }

  return <PublicFlipperProfileClient profile={profile} gigs={gigs || []} completedCount={completedCount || 0} photos={photos || []} />
}
