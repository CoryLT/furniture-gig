-- ============================================================
-- DIAGNOSTIC v2: $41.20 payout investigation
-- 2026-05-27
-- ============================================================
-- Same as diagnostic_payout_state_20260527.sql but with the
-- user IDs hardcoded so it works in Supabase's SQL Editor
-- (which runs as 'postgres' where auth.uid() is null).
--
-- Cory's admin/flipper account: ae847095-eaeb-4522-8cb3-001553933bf1
-- Cory's tester/worker account:  72f34512-113f-4c02-b638-0ddf3236d2a9
-- ============================================================

-- ------------------------------------------------------------
-- Query 1: Every payout_records row on the flipper's gigs
-- ------------------------------------------------------------
select
  pr.id                              as payout_id,
  g.title                            as gig_title,
  g.status                           as gig_status,
  pr.amount,
  pr.payout_status                   as legacy_payout_status,
  pr.payment_status                  as stripe_payment_status,
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
where coalesce(g.poster_user_id, g.created_by)
        = 'ae847095-eaeb-4522-8cb3-001553933bf1'::uuid
order by pr.created_at desc;


-- ------------------------------------------------------------
-- Query 2: Every completed gig the flipper posted, and whether
-- it has a payout_records row at all
-- ------------------------------------------------------------
select
  g.id           as gig_id,
  g.title,
  g.status       as gig_status,
  g.pay_amount,
  (
    select count(*)::int
      from public.payout_records pr2
     where pr2.gig_id = g.id
  )              as payout_row_count
from public.gigs g
where coalesce(g.poster_user_id, g.created_by)
        = 'ae847095-eaeb-4522-8cb3-001553933bf1'::uuid
  and g.status = 'completed'
order by g.created_at desc;


-- ------------------------------------------------------------
-- Query 3: Every claim by the tester worker, in case the payout
-- happened on a gig the tester claimed that wasn't posted by Cory
-- ------------------------------------------------------------
select
  pr.id                  as payout_id,
  g.title                as gig_title,
  g.status               as gig_status,
  pr.amount,
  pr.payout_status,
  pr.payment_status,
  pr.payout_date,
  pr.stripe_payment_intent_id,
  pr.created_at
from public.payout_records pr
left join public.gigs g
  on g.id = pr.gig_id
where pr.worker_user_id = '72f34512-113f-4c02-b638-0ddf3236d2a9'::uuid
order by pr.created_at desc;
