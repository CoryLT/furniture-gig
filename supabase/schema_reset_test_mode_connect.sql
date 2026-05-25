-- ============================================================
-- RESET TEST-MODE STRIPE DATA (CONNECT + CUSTOMERS + PAYOUT RECORDS)
-- ============================================================
-- Context: On 2026-05-25 we flipped Stripe from test mode to live mode.
-- All existing Stripe IDs in the database were created against test-mode
-- Stripe and don't exist in live-mode Stripe. They need to be cleared.
--
-- Affected:
--   1. worker_profiles  -> stripe_account_id + 4 status flags
--   2. users            -> stripe_customer_id (flipper saved cards)
--   3. payout_records   -> stripe_payment_intent_id, stripe_charge_id,
--                          stripe_transfer_id, payment_status
--
-- Run STEP 1 first to preview what changes. Then run STEP 2 to do it.
-- Then STEP 3 to verify.
-- ============================================================


-- ============================================================
-- STEP 1: PREVIEW — RUN THIS FIRST
-- ============================================================

-- 1a) Workers with a connected (test-mode) Stripe account
select
  'worker_profiles' as table_name,
  count(*) as rows_with_stripe_account
from public.worker_profiles
where stripe_account_id is not null;

-- 1b) Flippers with a saved (test-mode) Stripe customer
select
  'users' as table_name,
  count(*) as rows_with_stripe_customer
from public.users
where stripe_customer_id is not null;

-- 1c) Payout records with test-mode Stripe IDs
select
  'payout_records' as table_name,
  count(*) as rows_with_stripe_ids
from public.payout_records
where stripe_payment_intent_id is not null
   or stripe_charge_id is not null
   or stripe_transfer_id is not null;


-- ============================================================
-- STEP 2: THE RESET — RUN THIS AFTER REVIEWING STEP 1
-- ============================================================

-- 2a) Clear worker Stripe Connect data
update public.worker_profiles
set
  stripe_account_id = null,
  stripe_charges_enabled = false,
  stripe_payouts_enabled = false,
  stripe_details_submitted = false,
  stripe_onboarding_completed_at = null
where stripe_account_id is not null;

-- 2b) Clear flipper Stripe Customer IDs
update public.users
set stripe_customer_id = null
where stripe_customer_id is not null;

-- 2c) Clear test-mode Stripe IDs on payout records
update public.payout_records
set
  stripe_payment_intent_id = null,
  stripe_charge_id = null,
  stripe_transfer_id = null,
  payment_status = 'none'
where stripe_payment_intent_id is not null
   or stripe_charge_id is not null
   or stripe_transfer_id is not null;


-- ============================================================
-- STEP 3: VERIFY — RUN AFTER STEP 2
-- All three counts should be 0.
-- ============================================================

select
  (select count(*) from public.worker_profiles where stripe_account_id is not null) as workers_still_with_account,
  (select count(*) from public.users where stripe_customer_id is not null) as users_still_with_customer,
  (select count(*) from public.payout_records
     where stripe_payment_intent_id is not null
        or stripe_charge_id is not null
        or stripe_transfer_id is not null) as payout_records_still_with_ids;
