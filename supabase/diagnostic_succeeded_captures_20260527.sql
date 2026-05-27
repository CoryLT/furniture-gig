-- ============================================================
-- DIAGNOSTIC: state of the two SUCCEEDED Stripe captures
-- ============================================================
-- Two payments were actually captured (real money moved):
--   $41.51  claim 9b7f65ff-f346-47df-a53a-76e65529da89
--   $1.34   claim dbd80e91-4f06-4a3c-8462-822ecc3e28bd
--
-- For each one we want to know:
--   - Current claim status (should be 'approved')
--   - Current gig status (should be 'completed')
--   - Is there a payout_records row? If yes, what status?
--   - Worker name (for sanity check)
-- ============================================================

select
  gc.id                                   as claim_id,
  gc.status                               as claim_status,
  g.title                                 as gig_title,
  g.status                                as gig_status,
  g.pay_amount,
  wp.first_name || ' ' || wp.last_name    as worker_name,
  pr.id                                   as payout_id,
  pr.payout_status                        as legacy_payout_status,
  pr.payment_status                       as stripe_payment_status,
  pr.amount                               as payout_amount,
  pr.stripe_payment_intent_id,
  pr.stripe_charge_id,
  pr.payout_date,
  pr.created_at                           as payout_created_at
from public.gig_claims gc
left join public.gigs g
  on g.id = gc.gig_id
left join public.worker_profiles wp
  on wp.user_id = gc.worker_user_id
left join public.payout_records pr
  on pr.gig_id = gc.gig_id
 and pr.worker_user_id = gc.worker_user_id
where gc.id in (
  '9b7f65ff-f346-47df-a53a-76e65529da89'::uuid,
  'dbd80e91-4f06-4a3c-8462-822ecc3e28bd'::uuid
)
order by g.pay_amount desc;
