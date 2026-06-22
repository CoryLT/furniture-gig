import type { SupabaseClient } from '@supabase/supabase-js'

// ---- Freemium config (change these to tune free vs Pro) ----

// Free accounts can hold this many ACTIVE pieces (sourced/in progress/listed).
// Sold pieces don't count, so history is always free.
export const FREE_PIECE_CAP = 15

export const PRO_PRICE_LABEL = '$9/mo'

// Feature keys gated to Pro. Used by UI to show locks / upgrade prompts.
export type ProFeature = 'receipt_scanner' | 'tax_export' | 'payment_records' | 'unlimited_pieces'

export type PlanRow = {
  status: string
  is_founding: boolean
  stripe_customer_id: string | null
  current_period_end: string | null
}

// Is this subscription row a paying (or comped) Pro account?
export function isPro(row: PlanRow | null | undefined): boolean {
  if (!row) return false
  if (row.is_founding) return true
  return row.status === 'active' || row.status === 'trialing'
}

// Load a user's plan row (null if they've never had one — treat as free).
export async function getPlan(supabase: SupabaseClient, userId: string): Promise<PlanRow | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status, is_founding, stripe_customer_id, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as PlanRow) ?? null
}
