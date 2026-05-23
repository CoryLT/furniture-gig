// ============================================================
// POST /api/marketplace/create
// ============================================================
// Creates a marketplace_listings row after running the blocked-
// keyword filter. Returns the new listing id and slug.
//
// Body (JSON):
//   title, description, category_slug,
//   price_mode ('fixed' | 'free'), price_cents,
//   condition (optional),
//   location_city, location_state,
//   location_lat, location_lng (optional — fuzzed before insert)
//
// Returns:
//   200 { id, slug }
//   400 { error: '...', blockedPhrase?: string }
//   401 { error: 'Unauthorized' }
//   500 { error: 'Server error' }
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkBlockedKeywords,
  generateListingSlug,
  fuzzCoordinates,
} from '@/lib/marketplace-validation'

interface CreateBody {
  title?: string
  description?: string
  category_slug?: string
  price_mode?: 'fixed' | 'free'
  price_cents?: number
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'for_parts' | null
  location_city?: string
  location_state?: string
  location_lat?: number | null
  location_lng?: number | null
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = (body.title ?? '').trim()
  const description = (body.description ?? '').trim()
  const category_slug = (body.category_slug ?? '').trim()
  const price_mode = body.price_mode === 'free' ? 'free' : 'fixed'
  const price_cents =
    price_mode === 'free' ? 0 : Math.max(0, Math.floor(body.price_cents ?? 0))
  const condition = body.condition ?? null
  const location_city = (body.location_city ?? '').trim()
  const location_state = (body.location_state ?? '').trim()

  // Basic required-field checks
  if (!title) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  }
  if (title.length > 120) {
    return NextResponse.json(
      { error: 'Title must be 120 characters or less.' },
      { status: 400 }
    )
  }
  if (!category_slug) {
    return NextResponse.json(
      { error: 'Please pick a category.' },
      { status: 400 }
    )
  }
  if (!location_city || !location_state) {
    return NextResponse.json(
      { error: 'City and state are required.' },
      { status: 400 }
    )
  }
  if (price_mode === 'fixed' && price_cents <= 0) {
    return NextResponse.json(
      { error: 'Please enter a price greater than $0, or pick "Free".' },
      { status: 400 }
    )
  }
  // Hard upper limit so people don't post 1 trillion dollar listings
  if (price_cents > 100_000_00) {
    return NextResponse.json(
      { error: 'Price cannot exceed $100,000.' },
      { status: 400 }
    )
  }

  // Blocked-keyword check (title + description)
  const hit = await checkBlockedKeywords(title, description, supabase)
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

  // Fuzz coordinates before insert (so DB never has exact location)
  const { lat: fuzzedLat, lng: fuzzedLng } = fuzzCoordinates(
    body.location_lat ?? null,
    body.location_lng ?? null
  )

  const slug = generateListingSlug(title)

  const { data: inserted, error: insertError } = await supabase
    .from('marketplace_listings')
    // @ts-expect-error supabase insert generics
    .insert({
      seller_user_id: user.id,
      title,
      slug,
      description,
      category_slug,
      price_mode,
      price_cents,
      condition,
      location_city,
      location_state,
      location_lat: fuzzedLat,
      location_lng: fuzzedLng,
      status: 'active',
    })
    .select('id, slug')
    .single<{ id: string; slug: string }>()

  if (insertError || !inserted) {
    console.error('[marketplace/create] insert error:', insertError)
    return NextResponse.json(
      { error: insertError?.message ?? 'Could not save the listing.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: inserted.id, slug: inserted.slug })
}
