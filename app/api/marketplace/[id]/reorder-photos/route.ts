// ============================================================
// POST /api/marketplace/[id]/reorder-photos
// ============================================================
// Updates sort_order on all marketplace_photos for this listing
// based on the order of photoIds in the request body. The first
// id in the array becomes sort_order=0 (the cover photo), the
// next is 1, and so on.
//
// Owner or admin only. Photos not in the array are left alone
// (defensive — shouldn't happen in normal flow).
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { photoIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    !Array.isArray(body.photoIds) ||
    body.photoIds.length === 0 ||
    !body.photoIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return NextResponse.json(
      { error: 'photoIds must be a non-empty array of strings' },
      { status: 400 }
    )
  }
  const photoIds = body.photoIds as string[]

  // Verify the user owns this listing (or is admin)
  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_user_id')
    .eq('id', params.id)
    .single<{ id: string; seller_user_id: string }>()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  const isOwner = user.id === listing.seller_user_id
  const isAdmin = userRow?.role === 'admin'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Defensive: make sure every photoId actually belongs to this listing.
  // Without this check, a malicious caller could rewrite sort_order on
  // someone else's photos by passing in their IDs.
  const { data: existingPhotos } = await supabase
    .from('marketplace_photos')
    .select('id')
    .eq('listing_id', params.id)
    .in('id', photoIds)

  const existingIdSet = new Set((existingPhotos ?? []).map((p: any) => p.id))
  for (const id of photoIds) {
    if (!existingIdSet.has(id)) {
      return NextResponse.json(
        { error: 'One or more photo IDs do not belong to this listing.' },
        { status: 400 }
      )
    }
  }

  // Update each row with its new sort_order. We do this one at a time
  // because Supabase doesn't support a "batch update with different
  // values per row" in a single call without a stored procedure.
  // Listings cap at 10 photos so this is at most 10 updates.
  for (let i = 0; i < photoIds.length; i++) {
    const { error } = await supabase
      .from('marketplace_photos')
      // @ts-expect-error supabase update generics
      .update({ sort_order: i })
      .eq('id', photoIds[i])

    if (error) {
      console.error('[marketplace/reorder-photos] update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
