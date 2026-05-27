-- ============================================================
-- DIAGNOSTIC: where is the $41.20 payout?
-- 2026-05-27
-- ============================================================
-- The flipper dashboard's "Paid Out" tile reads from
-- payout_records.payout_status='paid'. The user reports paying
-- out $41.20 in real money (via Stripe), but the tile shows $0.
--
-- This script inspects the underlying data so we can figure out
-- whether:
--   A) No payout_records row exists at all for the completed gig
--      (some old flow approved the gig without writing here)
--   B) The row exists but payout_status is 'unpaid' or 'pending'
--      (Stripe authorized but capture never ran, or it ran but
--      didn't flip payout_status)
--   C) The row exists with payout_status='paid' but RLS is
--      hiding it from the flipper's session
--
-- READ-ONLY. Safe to run as many times as needed.
-- ============================================================

-- 1) All payout_records rows for gigs YOU posted, with the gig
--    title and worker name so the data is human-readable.
select
  pr.id                  as payout_id,
  g.title                as gig_title,
  pr.amount,
  pr.payout_status       as legacy_payout_status,
  pr.payment_status      as stripe_payment_status,
  pr.payout_date,
  pr.stripe_payment_intent_id,
  pr.stripe_charge_id,
  pr.created_at,
  wp.first_name || ' ' || wp.last_name as worker_name
from public.payout_records pr
left join public.gigs g
  on g.id = pr.gig_id
left join public.worker_profiles wp
  on wp.user_id = pr.worker_user_id
where coalesce(g.poster_user_id, g.created_by) = auth.uid()
order by pr.created_at desc;


-- 2) For comparison: every gig you posted that's marked completed,
--    with its claim status and whether a payout row exists at all.
select
  g.id                       as gig_id,
  g.title,
  g.status                   as gig_status,
  g.pay_amount,
  gc.status                  as claim_status,
  (
    select count(*)::int
      from public.payout_records pr2
     where pr2.gig_id = g.id
  )                          as payout_row_count
from public.gigs g
left join public.gig_claims gc
  on gc.gig_id = g.id
 and gc.status in ('approved', 'submitted_for_review', 'active')
where coalesce(g.poster_user_id, g.created_by) = auth.uid()
  and g.status = 'completed'
order by g.created_at desc;
