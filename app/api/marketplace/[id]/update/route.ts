// ============================================================
// POST /api/marketplace/[id]/update
// ============================================================
// Updates an existing listing's details. Runs the same blocked-
// keyword check as create. Same ownership rules.
//
// Fields accepted (all optional; whatever's provided gets updated):
//   title, description, category_slug,
//   price_mode, price_cents, condition,
//   location_city, location_state
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkBlockedKeywords } from '@/lib/marketplace-validation'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_user_id, title, description')
    .eq('id', params.id)
    .single<{
      id: string
      seller_user_id: string
      title: string
      description: string
    }>()

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Build the patch object, accepting only known fields
  const patch: Record<string, unknown> = {}

  if (typeof body.title === 'string') {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    if (t.length > 120) return NextResponse.json({ error: 'Title must be 120 characters or less.' }, { status: 400 })
    patch.title = t
  }
  if (typeof body.description === 'string') {
    patch.description = body.description.trim()
  }
  if (typeof body.category_slug === 'string' && body.category_slug.trim()) {
    patch.category_slug = body.category_slug.trim()
  }
  if (body.price_mode === 'fixed' || body.price_mode === 'free') {
    patch.price_mode = body.price_mode
  }
  if (typeof body.price_cents === 'number') {
    patch.price_cents = Math.max(0, Math.floor(body.price_cents))
  }
  // Free mode forces price to 0
  if (patch.price_mode === 'free') patch.price_cents = 0

  if (typeof body.price_cents === 'number' && (patch.price_mode === 'fixed' || (!patch.price_mode && body.price_mode === 'fixed'))) {
    if ((patch.price_cents as number) <= 0) {
      return NextResponse.json({ error: 'Please enter a price greater than $0, or pick "Free".' }, { status: 400 })
    }
    if ((patch.price_cents as number) > 100_000_00) {
      return NextResponse.json({ error: 'Price cannot exceed $100,000.' }, { status: 400 })
    }
  }

  if (
    body.condition === null ||
    body.condition === 'new' ||
    body.condition === 'like_new' ||
    body.condition === 'good' ||
    body.condition === 'fair' ||
    body.condition === 'for_parts'
  ) {
    patch.condition = body.condition
  }
  if (typeof body.location_city === 'string') {
    patch.location_city = body.location_city.trim()
  }
  if (typeof body.location_state === 'string') {
    patch.location_state = body.location_state.trim()
  }

  // Re-run keyword check on the new text (use the new values where
  // present, fall back to the existing ones)
  const newTitle = (patch.title as string | undefined) ?? listing.title
  const newDescription = (patch.description as string | undefined) ?? listing.description
  const hit = await checkBlockedKeywords(newTitle, newDescription, supabase)
  if (hit) {
    return NextResponse.json(
      {
        error:
          'This item isn\'t allowed on FlipWork. Please review our marketplace rules. If you think this is a mistake, contact support.',
        blockedPhrase: hit.phrase,
      },
      { status: 400 }
    )
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: true, noop: true })
  }

  const { error } = await supabase
    .from('marketplace_listings')
    // @ts-expect-error supabase update generics
    .update(patch)
    .eq('id', params.id)

  if (error) {
    console.error('[marketplace/update] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
