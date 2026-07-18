// ============================================================
// POST /api/offer/free-year/accept
// ============================================================
// Redeems the "1 year of FlipWork Pro on the house" campaign.
//
// Rules (in order):
//   1. Must be signed in.
//   2. If they've already redeemed this campaign, no-op with a
//      friendly "already redeemed" response.
//   3. If they're already on paid Pro or founding, we STILL record
//      the redemption row (so they can't cash it in later) but we
//      don't touch their subscription — no downgrading a real
//      subscription with a comp.
//   4. Otherwise, upsert their subscriptions row so
//      comp_expires_at = now() + 1 year and record the redemption.
//
// Uses the service-role client for the write (subscriptions has no
// client-write policy — the Stripe webhook + this route are the
// only writers).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const CAMPAIGN_ID = 'free-year-2026'

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Already redeemed?
  const { data: existingRedemption } = await admin
    .from('campaign_redemptions')
    .select('id, redeemed_at')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingRedemption) {
    return NextResponse.json({
      success: true,
      alreadyRedeemed: true,
      redeemedAt: (existingRedemption as any).redeemed_at,
    })
  }

  // Look at their current subscription to decide whether to touch it.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id, status, is_founding, comp_expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const alreadyPaid =
    (sub as any)?.is_founding === true ||
    (sub as any)?.status === 'active' ||
    (sub as any)?.status === 'trialing'

  // A year from right now, in UTC.
  const compUntil = new Date()
  compUntil.setUTCFullYear(compUntil.getUTCFullYear() + 1)
  const compUntilIso = compUntil.toISOString()

  // Record the redemption first — if this write fails we haven't
  // moved anything. On unique-constraint hit (race), fall through.
  const { error: redeemErr } = await admin
    .from('campaign_redemptions')
    .insert({
      campaign_id: CAMPAIGN_ID,
      user_id: user.id,
    } as any)

  if (redeemErr && (redeemErr as any).code !== '23505') {
    // 23505 = unique_violation. Anything else is a real problem.
    console.error('offer accept: redemption insert failed', redeemErr)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }

  // If they were already on paid/founding Pro, don't stomp their
  // real subscription with a comp — just leave it alone.
  if (alreadyPaid) {
    return NextResponse.json({
      success: true,
      alreadyPro: true,
    })
  }

  // Upsert the subscriptions row with the comp.
  const patch = {
    user_id: user.id,
    comp_expires_at: compUntilIso,
    // Don't touch status / stripe fields — leave them as-is if the
    // row exists. For a fresh row, status defaults to 'free' per
    // the schema, which is what we want.
  }
  const { error: upsertErr } = await admin
    .from('subscriptions')
    .upsert(patch as any, { onConflict: 'user_id' })

  if (upsertErr) {
    console.error('offer accept: subscription upsert failed', upsertErr)
    return NextResponse.json(
      {
        error:
          "We recorded your acceptance but couldn't activate Pro. We'll fix it manually — email CoryThacker@proton.me if you don't see it in a day.",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    compExpiresAt: compUntilIso,
  })
}
