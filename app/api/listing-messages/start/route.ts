import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/listing-messages/start
// Body: { listingId: string }
// Returns: { conversationId: string }
//
// Behavior:
//   - Caller must be logged in.
//   - Caller must NOT be the seller (sellers don't initiate; they get
//     pinged when a buyer sends the first message).
//   - If a (listing, caller) conversation already exists, return it.
//   - Otherwise, create one.
//
// Listing must be in 'active' or 'sold' status — hidden/deleted
// listings can't be messaged about.
export async function POST(req: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let listingId: string | null = null
  try {
    const body = await req.json()
    listingId = body?.listingId ?? null
  } catch {
    // ignore — handled by the null check below
  }
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listingId' }, { status: 400 })
  }

  // Look up the listing to find the seller and check status
  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_user_id, status')
    .eq('id', listingId)
    .maybeSingle<{ id: string; seller_user_id: string; status: string }>()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  if (!['active', 'sold'].includes(listing.status)) {
    return NextResponse.json(
      { error: 'This listing is no longer available.' },
      { status: 400 }
    )
  }

  if (listing.seller_user_id === user.id) {
    return NextResponse.json(
      { error: "You can't message yourself about your own listing." },
      { status: 400 }
    )
  }

  // 1) Does a conversation already exist for this (listing, buyer)?
  const { data: existing } = await supabase
    .from('listing_conversations')
    .select('id, seller_user_id, buyer_user_id')
    .eq('listing_id', listingId)
    .eq('buyer_user_id', user.id)
    .maybeSingle<{ id: string; seller_user_id: string; buyer_user_id: string }>()

  if (existing) {
    return NextResponse.json({ conversationId: existing.id })
  }

  // 2) Create the conversation
  const { data: created, error: insertError } = await supabase
    .from('listing_conversations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      listing_id: listingId,
      seller_user_id: listing.seller_user_id,
      buyer_user_id: user.id,
    } as any)
    .select('id')
    .single<{ id: string }>()

  if (insertError || !created) {
    // Race condition: another request may have created it. Try fetching again.
    const { data: retry } = await supabase
      .from('listing_conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_user_id', user.id)
      .maybeSingle<{ id: string }>()
    if (retry) {
      return NextResponse.json({ conversationId: retry.id })
    }
    return NextResponse.json(
      { error: 'Could not start conversation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ conversationId: created.id })
}
