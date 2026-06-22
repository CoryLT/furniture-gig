-- ============================================================
-- FLIPWORK — subscriptions (Pro billing)  —  2026-06-22
-- ============================================================
-- One row per user. The Stripe webhook (service role) keeps it in sync.
-- The app reads it to decide who's on Pro. Users can read only their own
-- row; only the webhook (service role, bypasses RLS) can write it, so a
-- user can't fake Pro.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'free',
  -- free | active | trialing | past_due | canceled | incomplete | unpaid
  price_id               text,
  current_period_end     timestamptz,
  is_founding            boolean not null default false,
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

-- A user may read only their own subscription row.
drop policy if exists subs_own_select on public.subscriptions;
create policy subs_own_select on public.subscriptions
  for select using (auth.uid() = user_id);

-- No client insert/update/delete policies on purpose: the Stripe webhook
-- writes this table with the service role (which bypasses RLS), so the
-- browser can never grant itself Pro.

-- ============================================================
-- End — subscriptions
-- ============================================================
