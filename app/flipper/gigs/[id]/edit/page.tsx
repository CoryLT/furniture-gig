import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import EditGigForm from './EditGigForm'
import type { GigImageRow } from '@/types/database'

export default async function EditGigPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Only the gig's owner can edit — explicit filter on poster_user_id
  // plus the RLS policy gives us defense in depth.
  const { data: gig } = await supabase
    .from('gigs')
    .select('*')
    .eq('id', params.id)
    .eq('poster_user_id', user.id)
    .single()

  if (!gig) notFound()

  // Are there any claims that are still "live" (not cancelled or rejected)?
  // Used to decide whether to show the warning banner.
  const { data: claims } = await supabase
    .from('gig_claims')
    .select('id, status')
    .eq('gig_id', gig.id)

  const hasActiveClaim = (claims ?? []).some(
    (c) => c.status !== 'cancelled' && c.status !== 'rejected'
  )

  // Load existing images so the editor can show and re-order them.
  const { data: imagesData } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const images = (imagesData ?? []) as GigImageRow[]

  return <EditGigForm gig={gig} hasActiveClaim={hasActiveClaim} images={images} />
}
