import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  formatPriceFromCents,
  timeAgo,
  conditionLabel,
  getSiteUrl,
} from '@/lib/utils'
import { MapPin, Tag, Calendar, Package, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PublicTopBar from '@/components/shared/PublicTopBar'
import Nav from '@/components/shared/Nav'
import PhotoCarousel from './PhotoCarousel'
import MessageSellerButton from '@/components/shared/MessageSellerButton'
import ShareButton from '@/components/shared/ShareButton'
import type {
  MarketplaceListingRow,
  MarketplacePhotoRow,
  MarketplaceCategoryRow,
} from '@/types/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { slug: string }
}

export default async function MarketplaceListingPage({ params }: Props) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: listingData } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()

  const listing = listingData as MarketplaceListingRow | null
  if (!listing) notFound()

  // Sold listings are still visible. Hidden/deleted are not.
  if (!['active', 'sold'].includes(listing.status)) notFound()

  // Photos
  const { data: photosData } = await supabase
    .from('marketplace_photos')
    .select('*')
    .eq('listing_id', listing.id)
    .order('sort_order')

  const photos = (photosData ?? []) as MarketplacePhotoRow[]

  // Category label
  const { data: categoryData } = await supabase
    .from('marketplace_categories')
    .select('*')
    .eq('slug', listing.category_slug)
    .maybeSingle()
  const category = categoryData as MarketplaceCategoryRow | null

  // Seller info — try worker_profiles then flipper_profiles
  let sellerUsername: string | null = null
  let sellerDisplayName: string | null = null
  let sellerAvatarUrl: string | null = null
  let sellerJoinedAt: string | null = null

  const { data: workerSeller } = await supabase
    .from('worker_profiles')
    .select('username, first_name, last_name, avatar_url, created_at')
    .eq('user_id', listing.seller_user_id)
    .maybeSingle()

  if (workerSeller) {
    sellerUsername = workerSeller.username
    sellerDisplayName =
      [workerSeller.first_name, workerSeller.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null
    sellerAvatarUrl = workerSeller.avatar_url || null
    sellerJoinedAt = workerSeller.created_at
  } else {
    const { data: flipperSeller } = await supabase
      .from('flipper_profiles')
      .select('username, display_name, avatar_url, created_at')
      .eq('user_id', listing.seller_user_id)
      .maybeSingle()
    if (flipperSeller) {
      sellerUsername = flipperSeller.username
      sellerDisplayName = flipperSeller.display_name || null
      sellerAvatarUrl = flipperSeller.avatar_url || null
      sellerJoinedAt = flipperSeller.created_at
    }
  }

  const isOwnListing = !!user && listing.seller_user_id === user.id

  // For Nav rendering
  let userRole: 'worker' | 'admin' | 'flipper' = 'worker'
  let userName: string | undefined
  let userUsername: string | undefined
  if (user) {
    const { data: row } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (row?.role) userRole = row.role
    const { data: wp } = await supabase
      .from('worker_profiles')
      .select('first_name, username')
      .eq('user_id', user.id)
      .maybeSingle()
    if (wp) {
      userName = wp.first_name ?? undefined
      userUsername = wp.username ?? undefined
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
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Back link */}
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to marketplace
          </Link>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Photo carousel — takes 3/5 on large screens */}
            <div className="lg:col-span-3">
              <PhotoCarousel photos={photos} title={listing.title} />
            </div>

            {/* Right column: details + seller + actions */}
            <div className="lg:col-span-2 space-y-4">
              {/* Price + title + sold badge */}
              <div>
                {listing.status === 'sold' && (
                  <div className="inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold mb-2">
                    SOLD
                  </div>
                )}
                <div className="text-3xl font-mono font-semibold text-foreground">
                  {formatPriceFromCents(listing.price_cents, listing.price_mode)}
                </div>
                <h1 className="text-2xl text-foreground mt-1 leading-tight">
                  {listing.title}
                </h1>
                <div className="text-xs text-muted-foreground mt-1">
                  Posted {timeAgo(listing.created_at)}
                </div>
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {category && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-foreground">
                    <Tag className="w-3 h-3" />
                    {category.label}
                  </span>
                )}
                {listing.condition && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-foreground">
                    <Package className="w-3 h-3" />
                    {conditionLabel(listing.condition)}
                  </span>
                )}
                {(listing.location_city || listing.location_state) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-foreground">
                    <MapPin className="w-3 h-3" />
                    {[listing.location_city, listing.location_state]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                )}
              </div>

              {/* Contact / action buttons */}
              <div className="card card-body space-y-3">
                {isOwnListing ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      This is your listing.
                    </p>
                    <Link href={`/marketplace/mine`}>
                      <Button variant="outline" className="w-full">
                        Manage my listings
                      </Button>
                    </Link>
                  </>
                ) : user ? (
                  <>
                    <MessageSellerButton listingId={listing.id} />
                    <p className="text-xs text-muted-foreground text-center">
                      You'll be able to chat with the seller about this item.
                    </p>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/auth/signup?next=/marketplace/${listing.slug}`}
                    >
                      <Button variant="accent" className="w-full">
                        Sign up to message seller
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground text-center">
                      Free account &middot; takes about 30 seconds
                    </p>
                  </>
                )}
                {/* Share lives outside the if/else so it's always available */}
                <div className="pt-1 flex justify-center">
                  <ShareButton
                    url={`${getSiteUrl()}/marketplace/${listing.slug}`}
                    title={listing.title}
                    kind="listing"
                  />
                </div>
              </div>

              {/* Seller card */}
              <div className="card card-body space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Seller
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                    {sellerAvatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={sellerAvatarUrl}
                        alt={sellerDisplayName ?? 'Seller'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-stone-500">
                        {(sellerDisplayName ?? sellerUsername ?? '?')
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {sellerDisplayName ?? sellerUsername ?? 'A FlipWork user'}
                    </div>
                    {sellerJoinedAt && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Joined {new Date(sellerJoinedAt).toLocaleDateString(
                          'en-US',
                          { month: 'short', year: 'numeric' }
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {sellerUsername && (
                  <Link
                    href={`/u/${sellerUsername}`}
                    className="block w-full text-center text-sm text-accent hover:underline"
                  >
                    View profile →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Description (full width, below the photo + meta) */}
          {listing.description && (
            <div className="card card-body mt-6">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                Description
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FlipWork. All rights reserved.
      </footer>
    </div>
  )
}
