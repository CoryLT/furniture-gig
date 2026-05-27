-- ============================================================
-- DIAGNOSTIC: status of the two uncaptured Stripe authorizations
-- ============================================================
-- These two Stripe authorizations exist as "Uncaptured" holds
-- (real money is held on the flipper's card, no capture has
-- happened yet, will release in ~7 days if untouched):
--
--   Claim 28d915ab-1a71-4696-9eda-ed5ae7b455d1 -> $41.51
--   Claim a16e17f9-84df-46de-9e04-77c93901906a -> $51.81
--
-- We need to know what state these gigs/claims are in inside
-- the DB so we can figure out whether:
--   A) The user approved them but capture silently failed
--   B) The user never approved them (gig still in progress)
--   C) Something else weird
--
-- READ-ONLY. Safe to run.
-- ============================================================

select
  gc.id                            as claim_id,
  gc.status                        as claim_status,
  gc.created_at                    as claim_created,
  g.id                             as gig_id,
  g.title                          as gig_title,
  g.status                         as gig_status,
  g.pay_amount,
  wp.first_name || ' ' || wp.last_name as worker_name,
  pr.id                            as payout_id,
  pr.payout_status                 as legacy_payout_status,
  pr.payment_status                as stripe_payment_status,
  pr.stripe_payment_intent_id,
  pr.amount                        as payout_amount,
  pr.created_at                    as payout_created,
  pr.payout_date
from public.gig_claims gc
left join public.gigs g
  on g.id = gc.gig_id
left join public.worker_profiles wp
  on wp.user_id = gc.worker_user_id
left join public.payout_records pr
  on pr.gig_id = gc.gig_id
 and pr.worker_user_id = gc.worker_user_id
where gc.id in (
  '28d915ab-1a71-4696-9eda-ed5ae7b455d1'::uuid,
  'a16e17f9-84df-46de-9e04-77c93901906a'::uuid
)
order by gc.created_at;
