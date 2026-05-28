import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PublicProfileClient } from '@/components/profile/PublicProfileClient'

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const supabase = createClient()
  const username = params.username.toLowerCase()

  // Pull from BOTH profile tables in parallel so we can show one unified view
  const [workerResult, flipperResult] = await Promise.all([
    supabase
      .from('worker_profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle(),
    supabase
      .from('flipper_profiles')
      .select('*')
      .eq('username', username)
      .eq('profile_public', true)
      .maybeSingle(),
  ])

  const worker = workerResult.data as any
  const flipper = flipperResult.data as any

  // If neither table has a row for this username, 404
  if (!worker && !flipper) {
    notFound()
  }

  // Pick a userId from whichever table has data
  const userId = worker?.user_id || flipper?.user_id

  // Has this user cleared a real-money trust check?
  //   - worker: Stripe Connect active (KYC, bank, ID all confirmed by Stripe)
  //   - flipper: has at least one captured/transferred/refunded payout (real
  //     card ran real money)
  // Either one earns the blue checkmark next to their name.
  let isVerified = false
  if (userId) {
    const { data: verifiedResult } = await (supabase.rpc as any)(
      'is_user_verified',
      { target_user_id: userId }
    )
    isVerified = verifiedResult === true
  }

  // Merged profile data — prefer non-empty values across both tables
  const merged = {
    user_id: userId,
    username,
    fullName: worker?.full_name || '',
    avatarUrl: worker?.avatar_url || flipper?.avatar_url || '',
    city: worker?.city || flipper?.city || '',
    state: worker?.state || flipper?.state || '',
    businessName: flipper?.business_name || '',
    bio: flipper?.bio || worker?.bio || '',
    website: flipper?.website || '',
    skills: (worker?.skills as string[]) || [],
    isFoundingMember:
      worker?.founding_member === true || flipper?.founding_member === true,
    isVerified,
  }

  // Pull their open gigs (as a poster) and completed count
  const [openGigsResult, completedCountResult] = userId
    ? await Promise.all([
        supabase
          .from('gigs')
          .select('*')
          .eq('poster_user_id', userId)
          .in('status', ['open'])
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('gigs')
          .select('*', { count: 'exact', head: true })
          .eq('poster_user_id', userId)
          .eq('status', 'completed'),
      ])
    : [{ data: [] }, { count: 0 }]

  const openGigs = openGigsResult.data || []
  const completedCount = (completedCountResult as any).count || 0

  // Grab one thumbnail per open gig so the cards on the profile look
  // alive instead of being text-only. Single batched query, lowest
  // sort_order wins per gig.
  const openGigIds = openGigs.map((g: any) => g.id)
  const { data: gigImagesRaw } = openGigIds.length > 0
    ? await supabase
        .from('gig_images')
        .select('gig_id, file_path, sort_order')
        .in('gig_id', openGigIds)
        .order('sort_order')
    : { data: [] }

  const gigThumbnails: Record<string, string> = {}
  for (const img of (gigImagesRaw ?? []) as { gig_id: string; file_path: string }[]) {
    if (!gigThumbnails[img.gig_id]) {
      gigThumbnails[img.gig_id] = supabase.storage
        .from('gig-images')
        .getPublicUrl(img.file_path).data.publicUrl
    }
  }

  // Pull this user's active marketplace listings so we can show them
  // on the profile. We deliberately exclude sold/hidden — only active
  // items are useful to a visitor right now. Cap at 12, newest first.
  const { data: listingsRaw } = userId
    ? await supabase
        .from('marketplace_listings')
        .select('id, slug, title, price_cents, price_mode, condition, location_city, location_state, created_at, status')
        .eq('seller_user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12)
    : { data: [] }

  const listings = (listingsRaw ?? []) as Array<{
    id: string
    slug: string
    title: string
    price_cents: number
    price_mode: 'fixed' | 'free'
    condition: string | null
    location_city: string
    location_state: string
    created_at: string
    status: string
  }>

  // One thumbnail per listing — same pattern as gigs above.
  const listingIds = listings.map((l) => l.id)
  const { data: listingPhotosRaw } = listingIds.length > 0
    ? await supabase
        .from('marketplace_photos')
        .select('listing_id, file_path, sort_order')
        .in('listing_id', listingIds)
        .order('sort_order')
    : { data: [] }

  const listingThumbnails: Record<string, string> = {}
  for (const ph of (listingPhotosRaw ?? []) as { listing_id: string; file_path: string }[]) {
    if (!listingThumbnails[ph.listing_id]) {
      listingThumbnails[ph.listing_id] = supabase.storage
        .from('marketplace-photos')
        .getPublicUrl(ph.file_path).data.publicUrl
    }
  }

  // Pull this user's active services (what they offer) with the
  // category label joined in. Cap at 10 (the per-worker max).
  const { data: servicesRaw } = userId
    ? await supabase
        .from('worker_services')
        .select('id, blurb, price_type, price_amount, sort_order, category:service_categories(label, slug)')
        .eq('worker_user_id', userId)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .limit(10)
    : { data: [] }

  const services = ((servicesRaw ?? []) as any[]).map((s) => ({
    id: s.id,
    blurb: s.blurb || '',
    price_type: s.price_type,
    price_amount: s.price_amount,
    categoryLabel: Array.isArray(s.category)
      ? s.category[0]?.label || 'Service'
      : s.category?.label || 'Service',
  }))

  // Pull photo galleries from BOTH worker and flipper tables, combine
  const [workerPhotosResult, flipperPhotosResult] = userId
    ? await Promise.all([
        supabase
          .from('worker_photo_galleries')
          .select('*')
          .eq('worker_user_id', userId)
          .order('display_order', { ascending: true }),
        supabase
          .from('flipper_photo_galleries')
          .select('*')
          .eq('flipper_user_id', userId)
          .order('display_order', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }]

  // Who is viewing this page? (null if logged out)
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()

  // Is the viewer already following this profile?
  let viewerIsFollowing = false
  if (viewer && userId && viewer.id !== userId) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_user_id', viewer.id)
      .eq('followed_user_id', userId)
      .maybeSingle()
    viewerIsFollowing = !!followRow
  }

  // If the viewer IS the profile owner, fetch their follower count.
  // Private: only the owner sees this number.
  let ownFollowerCount: number | null = null
  if (viewer && userId && viewer.id === userId) {
    const { data: countResult } = await supabase.rpc('follower_count', {
      target_user_id: userId,
    })
    ownFollowerCount = (countResult as number | null) ?? 0
  }

  return (
    <PublicProfileClient
      profile={merged}
      openGigs={openGigs}
      gigThumbnails={gigThumbnails}
      listings={listings}
      listingThumbnails={listingThumbnails}
      services={services}
      completedCount={completedCount}
      workerPhotos={workerPhotosResult.data || []}
      flipperPhotos={flipperPhotosResult.data || []}
      viewerUserId={viewer?.id || null}
      viewerIsFollowing={viewerIsFollowing}
      ownFollowerCount={ownFollowerCount}
    />
  )
}
