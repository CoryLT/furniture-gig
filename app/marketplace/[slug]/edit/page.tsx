// ============================================================
// /marketplace/[slug]/edit
// ============================================================
// Edit an existing listing. Auth + ownership required (admin OK).
// Loads the listing, its photos, and the category list, then
// hands off to the client EditListingForm.
// ============================================================

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/shared/Nav'
import EditListingForm from './EditListingForm'
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

export default async function EditListingPage({ params }: Props) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?next=/marketplace/${params.slug}/edit`)
  }

  const { data: listingData } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle()
  const listing = listingData as MarketplaceListingRow | null
  if (!listing) notFound()

  // Ownership check (or admin)
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = (userRow as { role: 'worker' | 'admin' | 'flipper' } | null)?.role ?? 'worker'

  if (listing.seller_user_id !== user.id && role !== 'admin') {
    notFound()
  }

  const { data: photosData } = await supabase
    .from('marketplace_photos')
    .select('*')
    .eq('listing_id', listing.id)
    .order('sort_order')
  const photos = (photosData ?? []) as MarketplacePhotoRow[]

  const { data: categoriesData } = await supabase
    .from('marketplace_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  const categories = (categoriesData ?? []) as MarketplaceCategoryRow[]

  // For Nav
  const { data: wp } = await supabase
    .from('worker_profiles')
    .select('first_name, username')
    .eq('user_id', user.id)
    .maybeSingle()
  const w = (wp as { first_name: string | null; username: string | null } | null) ?? null

  return (
    <div className="min-h-screen bg-background">
      <Nav
        role={role}
        userName={w?.first_name ?? undefined}
        userUsername={w?.username ?? undefined}
      />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <EditListingForm
          listing={listing}
          initialPhotos={photos}
          categories={categories}
        />
      </main>
    </div>
  )
}
