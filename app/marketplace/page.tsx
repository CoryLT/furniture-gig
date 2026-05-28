import { createClient } from '@/lib/supabase/server'
import { requireAgreementsAccepted } from '@/lib/agreements-gate'
import PublicTopBar from '@/components/shared/PublicTopBar'
import Nav from '@/components/shared/Nav'
import MarketplaceFeed from './MarketplaceFeed'
import type {
  MarketplaceListingRow,
  MarketplacePhotoRow,
} from '@/types/database'

// Marketplace is public, but content changes constantly — bypass the cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MarketplacePage() {
  const supabase = createClient()

  // Who is viewing? (may be null — public access allowed)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If logged in, force them through the agreements gate if any
  // required agreement is pending. Logged-out visitors can still
  // browse the marketplace freely.
  if (user) {
    await requireAgreementsAccepted(supabase, user.id, '/marketplace')
  }

  // Get the latest active listings — most recent first.
  // We grab a generous batch (60) so the client can filter/sort
  // without a round trip. Pagination comes later if needed.
  const { data: listingsData } = await supabase
    .from('marketplace_listings')
    .select('*')
    .in('status', ['active', 'sold'])
    .order('created_at', { ascending: false })
    .limit(60)

  const listings = (listingsData ?? []) as MarketplaceListingRow[]

  // Get a cover photo (the lowest sort_order) for each listing in one query
  const listingIds = listings.map((l) => l.id)
  let photosByListing = new Map<string, MarketplacePhotoRow>()

  if (listingIds.length > 0) {
    const { data: photosData, error: photosError } = await supabase
      .from('marketplace_photos')
      .select('*')
      .in('listing_id', listingIds)
      .order('sort_order')

    // TEMP DIAGNOSTIC — remove after we figure out why card thumbnails are blank
    console.log('[marketplace] photo query', {
      requested_listing_ids: listingIds,
      returned_photo_count: photosData?.length ?? 0,
      first_few_photos: (photosData ?? []).slice(0, 3).map((p: any) => ({
        listing_id: p.listing_id,
        file_path: p.file_path,
        sort_order: p.sort_order,
      })),
      error: photosError?.message ?? null,
    })

    const photos = (photosData ?? []) as MarketplacePhotoRow[]
    // First photo per listing wins (already sorted by sort_order asc)
    for (const photo of photos) {
      if (!photosByListing.has(photo.listing_id)) {
        photosByListing.set(photo.listing_id, photo)
      }
    }
  }

  // Get seller usernames + display info for the cards (one query)
  const sellerIds = Array.from(new Set(listings.map((l) => l.seller_user_id)))
  let sellersById = new Map<
    string,
    { username: string | null; display_name: string | null }
  >()

  if (sellerIds.length > 0) {
    // Try worker_profiles first
    const { data: workers } = await supabase
      .from('worker_profiles')
      .select('user_id, username, first_name, last_name')
      .in('user_id', sellerIds)

    for (const w of workers ?? []) {
      const name = [w.first_name, w.last_name].filter(Boolean).join(' ').trim()
      sellersById.set(w.user_id, {
        username: w.username,
        display_name: name || null,
      })
    }

    // Fill in any missing with flipper_profiles
    const missing = sellerIds.filter((id) => !sellersById.has(id))
    if (missing.length > 0) {
      const { data: flippers } = await supabase
        .from('flipper_profiles')
        .select('user_id, username, display_name')
        .in('user_id', missing)

      for (const f of flippers ?? []) {
        sellersById.set(f.user_id, {
          username: f.username,
          display_name: f.display_name,
        })
      }
    }
  }

  // Stitch the listing data with photo + seller info for the client
  const enriched = listings.map((l) => {
    const photo = photosByListing.get(l.id) ?? null
    const seller = sellersById.get(l.seller_user_id) ?? {
      username: null,
      display_name: null,
    }
    return {
      ...l,
      cover_photo_path: photo?.file_path ?? null,
      seller_username: seller.username,
      seller_display_name: seller.display_name,
    }
  })

  // ============================================================
  // Services — what members offer to do for hire.
  // These live in worker_services (not marketplace_listings) and have
  // no photos or location of their own. The provider's profile city is
  // used for the city filter on the client.
  // ============================================================
  const { data: servicesRaw } = await supabase
    .from('worker_services')
    .select(
      'id, blurb, price_type, price_amount, worker_user_id, sort_order, category:service_categories(label)'
    )
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(60)

  const serviceRows = (servicesRaw ?? []) as any[]

  // Look up each provider's username, name, and city (one pass over both
  // profile tables, same approach as sellers above).
  const providerIds = Array.from(
    new Set(serviceRows.map((s) => s.worker_user_id))
  )
  const providersById = new Map<
    string,
    { username: string | null; display_name: string | null; city: string | null }
  >()

  if (providerIds.length > 0) {
    const { data: pWorkers } = await supabase
      .from('worker_profiles')
      .select('user_id, username, first_name, last_name, city')
      .in('user_id', providerIds)

    for (const w of pWorkers ?? []) {
      const name = [w.first_name, w.last_name].filter(Boolean).join(' ').trim()
      providersById.set(w.user_id, {
        username: w.username,
        display_name: name || null,
        city: w.city ?? null,
      })
    }

    const missingProviders = providerIds.filter((id) => !providersById.has(id))
    if (missingProviders.length > 0) {
      const { data: pFlippers } = await supabase
        .from('flipper_profiles')
        .select('user_id, username, display_name, city')
        .in('user_id', missingProviders)

      for (const f of pFlippers ?? []) {
        providersById.set(f.user_id, {
          username: f.username,
          display_name: f.display_name,
          city: f.city ?? null,
        })
      }
    }
  }

  const services = serviceRows.map((s) => {
    const provider = providersById.get(s.worker_user_id) ?? {
      username: null,
      display_name: null,
      city: null,
    }
    return {
      id: s.id,
      categoryLabel: Array.isArray(s.category)
        ? s.category[0]?.label || 'Service'
        : s.category?.label || 'Service',
      blurb: s.blurb || '',
      price_type: s.price_type,
      price_amount: s.price_amount,
      provider_username: provider.username,
      provider_display_name: provider.display_name,
      provider_city: provider.city,
    }
  })

  // Look up the viewer's role for nav rendering + city for auto-filter
  let userRole: 'worker' | 'admin' | 'flipper' = 'worker'
  let userName: string | undefined
  let userUsername: string | undefined
  let viewerCity: string | null = null

  if (user) {
    const { data: row } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (row?.role) userRole = row.role

    const { data: wp } = await supabase
      .from('worker_profiles')
      .select('first_name, username, city')
      .eq('user_id', user.id)
      .maybeSingle()
    if (wp) {
      userName = wp.first_name ?? undefined
      userUsername = wp.username ?? undefined
      if (wp.city && wp.city.trim()) viewerCity = wp.city.trim()
    }

    // Fall back to flipper_profiles city if worker_profiles didn't have one
    if (!viewerCity) {
      const { data: fp } = await supabase
        .from('flipper_profiles')
        .select('city')
        .eq('user_id', user.id)
        .maybeSingle()
      if (fp?.city && fp.city.trim()) viewerCity = fp.city.trim()
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {user ? (
        <Nav role={userRole} userName={userName} userUsername={userUsername} />
      ) : (
        <PublicTopBar current="marketplace" />
      )}

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <MarketplaceFeed
            initialListings={enriched}
            initialServices={services}
            isLoggedIn={!!user}
            viewerCity={viewerCity}
          />
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FlipWork. All rights reserved.
      </footer>
    </div>
  )
}
