-- ============================================================
-- STRIPE CONNECT INTEGRATION
-- Adds tracking columns + new tables for Stripe-based payouts.
-- Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- 1) Track each worker's Stripe Connect account
alter table public.worker_profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_onboarding_completed_at timestamptz;

-- 2) Track each flipper's Stripe Customer (for saved payment methods)
-- Flippers don't have a profile table yet; we'll store on users.
alter table public.users
  add column if not exists stripe_customer_id text;

-- 3) Add Stripe payment intent tracking to payout_records
alter table public.payout_records
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_transfer_id text,
  add column if not exists flipper_user_id uuid references public.users(id) on delete set null,
  add column if not exists gross_amount numeric(10,2),         -- what flipper paid (gig + fees)
  add column if not exists stripe_fee_amount numeric(10,2),    -- ~2.9% + 30c
  add column if not exists platform_fee_amount numeric(10,2),  -- our 2% cut
  add column if not exists payment_status text not null default 'none'
    check (payment_status in (
      'none',           -- no payment intent created yet (legacy / manual)
      'requires_method',-- flipper hasn't added card yet
      'authorized',     -- card authorized, money held (flipper picked worker)
      'captured',       -- money taken from flipper (admin approved work)
      'transferred',    -- money sent to worker's Stripe account
      'failed',         -- charge failed
      'canceled',       -- authorization released without capture
      'refunded'        -- captured then refunded
    ));

-- 4) Index for quick lookups by payment intent
create index if not exists payout_records_payment_intent_idx
  on public.payout_records (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- 5) Index for worker Stripe account lookups
create index if not exists worker_profiles_stripe_account_idx
  on public.worker_profiles (stripe_account_id)
  where stripe_account_id is not null;

-- ============================================================
-- DONE
-- ============================================================
