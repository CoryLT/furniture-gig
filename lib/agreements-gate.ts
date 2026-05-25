/**
 * Agreements gate helper.
 *
 * Use this from any server page where, if the visitor IS logged in,
 * they MUST have accepted all required active agreements before
 * seeing the page. Returns nothing if all good; calls redirect()
 * to /auth/agreements?next=<current-path> if anything's pending.
 *
 * Call this AFTER you've fetched `user` from supabase.auth.getUser().
 * If the user is null (logged out), do NOT call this — most callers
 * want to allow logged-out viewing on public pages.
 *
 * Why we do this in a per-page helper rather than middleware:
 *   - Middleware runs on the Edge runtime, which doesn't have a
 *     Supabase service-role client and can't easily do DB queries.
 *   - Doing a DB hit on every single request would slow the whole
 *     app. This helper only runs on pages where it's actually
 *     relevant (post-auth landing pages, gated features).
 */
import { redirect } from 'next/navigation'

// We type `supabase` as `any` here because the project's `SupabaseClient`
// is generic over `Database` and gets narrowed differently at every call
// site. Following the existing codebase pattern (`as any` casts around
// every Supabase mutation that touches Stripe-era columns), we keep this
// loose to avoid the same TS friction.

export async function requireAgreementsAccepted(
  supabase: any,
  userId: string,
  currentPath: string
): Promise<void> {
  // Pull every active+required agreement and the user's acceptances
  // in parallel. Both queries are tiny (handful of rows) and indexed.
  const [agreementsRes, acceptancesRes] = await Promise.all([
    supabase
      .from('legal_agreements')
      .select('id')
      .eq('required', true)
      .eq('active', true),
    supabase
      .from('user_agreement_acceptances')
      .select('agreement_id')
      .eq('user_id', userId),
  ])

  const required = agreementsRes.data ?? []
  const accepted = new Set(
    (acceptancesRes.data ?? []).map((a: { agreement_id: string }) => a.agreement_id)
  )

  const hasPending = required.some((ag: { id: string }) => !accepted.has(ag.id))

  if (hasPending) {
    // Preserve the user's intended destination so they bounce back
    // to it after accepting.
    const next = currentPath && currentPath.startsWith('/') ? currentPath : '/marketplace'
    redirect(`/auth/agreements?next=${encodeURIComponent(next)}`)
  }
}
