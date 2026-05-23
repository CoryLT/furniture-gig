// ============================================================
// /marketplace/mine
// ============================================================
// "My Listings" page — mirrors /flipper/dashboard's layout and
// vibe (same header, stat tiles, filter/sort list).
//
// Auth required. Loads ALL of the user's listings regardless of
// status (active / sold / hidden / deleted), and shows them with
// per-card actions (View / Edit / Mark Sold / Hide / Delete).
// ============================================================

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/shared/Nav'
import MyListingsList, { type MyListing } from './MyListingsList'
import {
  Plus,
  Package,
  CheckCircle2,
  EyeOff,
  ShoppingBag,
} from 'lucide-react'
import { formatPriceFromCents } from '@/lib/utils'
import type {
  MarketplaceListingRow,
  MarketplacePhotoRow,
} from '@/types/database'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyListingsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/marketplace/mine')

  // Load all listings for this seller, excluding hard-deleted
  const { data: listingsRaw } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('seller_user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  const listings = (listingsRaw ?? []) as MarketplaceListingRow[]

  // Cover photos in one query
  const listingIds = listings.map((l) => l.id)
  const photoByListing = new Map<string, MarketplacePhotoRow>()
  if (listingIds.length > 0) {
    const { data: photosData } = await supabase
      .from('marketplace_photos')
      .select('*')
      .in('listing_id', listingIds)
      .order('sort_order')

    for (const p of (photosData ?? []) as MarketplacePhotoRow[]) {
      if (!photoByListing.has(p.listing_id)) {
        photoByListing.set(p.listing_id, p)
      }
    }
  }

  // Build cover URLs (signed via the public bucket helper, server-side)
  const enriched: MyListing[] = listings.map((l) => {
    const photo = photoByListing.get(l.id)
    let coverUrl: string | null = null
    if (photo) {
      const { data } = supabase.storage
        .from('marketplace-photos')
        .getPublicUrl(photo.file_path)
      coverUrl = data.publicUrl
    }
    return {
      id: l.id,
      slug: l.slug,
      title: l.title,
      status: l.status,
      price_cents: l.price_cents,
      price_mode: l.price_mode,
      city: l.location_city,
      state: l.location_state,
      created_at: l.created_at,
      sold_at: l.sold_at,
      cover_url: coverUrl,
    }
  })

  // Stats
  const totalCount = enriched.length
  const activeCount = enriched.filter((l) => l.status === 'active').length
  const soldCount = enriched.filter((l) => l.status === 'sold').length
  const hiddenCount = enriched.filter((l) => l.status === 'hidden').length
  const soldRevenueCents = enriched
    .filter((l) => l.status === 'sold')
    .reduce((sum, l) => sum + l.price_cents, 0)

  // For Nav
  let userRole: 'worker' | 'admin' | 'flipper' = 'worker'
  let userName: string | undefined
  let userUsername: string | undefined

  const { data: row } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (row?.role) userRole = (row as { role: typeof userRole }).role

  const { data: wp } = await supabase
    .from('worker_profiles')
    .select('first_name, username')
    .eq('user_id', user.id)
    .maybeSingle()
  if (wp) {
    const w = wp as { first_name: string | null; username: string | null }
    userName = w.first_name ?? undefined
    userUsername = w.username ?? undefined
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav role={userRole} userName={userName} userUsername={userUsername} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl text-foreground">My Listings</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage items you&apos;ve listed on the marketplace
              </p>
            </div>
            <Link
              href="/marketplace/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              List item
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card card-body">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-semibold text-foreground">
                    {totalCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
            <div className="card card-body">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-semibold text-foreground">
                    {activeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </div>
            <div className="card card-body">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-semibold text-foreground">
                    {soldCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Sold</p>
                </div>
              </div>
            </div>
            <div className="card card-body">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <EyeOff className="w-4 h-4 text-stone-600" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-semibold text-foreground">
                    {hiddenCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Hidden</p>
                </div>
              </div>
            </div>
          </div>

          {/* "Revenue from sold" hint — only show if there are sales */}
          {soldCount > 0 && (
            <div className="card card-body bg-green-50/50 border-green-200">
              <p className="text-sm text-foreground">
                <span className="font-mono font-semibold">
                  {formatPriceFromCents(soldRevenueCents, 'fixed')}
                </span>{' '}
                in items marked sold. Mark items sold when the buyer picks them up.
              </p>
            </div>
          )}

          {/* List */}
          <div>
            {enriched.length === 0 ? (
              <div className="card card-body text-center py-16 space-y-3">
                <p className="text-lg text-muted-foreground">
                  You haven&apos;t listed anything yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  List your first item and start selling.
                </p>
                <Link
                  href="/marketplace/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  List your first item
                </Link>
              </div>
            ) : (
              <MyListingsList listings={enriched} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
