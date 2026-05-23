// ============================================================
// POST /api/marketplace/[id]/reactivate
// ============================================================
// Brings a 'sold' or 'hidden' listing back to 'active'.
// Clears sold_at. Only seller (or admin) can call this.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_user_id, status')
    .eq('id', params.id)
    .single<{ id: string; seller_user_id: string; status: string }>()

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

  if (!['sold', 'hidden'].includes(listing.status)) {
    return NextResponse.json(
      { error: 'Only sold or hidden listings can be reactivated.' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('marketplace_listings')
    // @ts-expect-error supabase update generics
    .update({ status: 'active', sold_at: null })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
