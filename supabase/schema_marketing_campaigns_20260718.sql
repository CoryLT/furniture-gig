-- ============================================================
-- FLIPWORK — marketing campaigns  —  2026-07-18
-- ============================================================
-- Adds the pieces needed to run a free-year Pro offer:
--
--   1. subscriptions.comp_expires_at
--      Time-bounded comp. If set and > now(), the user gets Pro.
--      isPro() in lib/plan.ts also checks this.
--
--   2. notification_preferences.email_marketing
--      Opt-in flag for promotional email. Default true because
--      the user opted in by signing up. Users can turn it off in
--      their prefs page, or by clicking the unsubscribe link.
--
--   3. notification_preferences.unsubscribe_token
--      A per-user UUID we drop into every marketing email's
--      unsubscribe link. Lets someone opt out with one click
--      without having to sign in first (which CAN-SPAM requires).
--
--   4. campaign_redemptions
--      One row per (campaign_id, user_id) so nobody double-dips
--      on a comp — the offer-accept endpoint checks here before
--      writing to subscriptions.
--
-- Idempotent. Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1) subscriptions.comp_expires_at
-- ------------------------------------------------------------
alter table public.subscriptions
  add column if not exists comp_expires_at timestamptz;

comment on column public.subscriptions.comp_expires_at is
  'Time-bounded Pro comp. If set and in the future, user is Pro.';


-- ------------------------------------------------------------
-- 2) notification_preferences.email_marketing
-- ------------------------------------------------------------
alter table public.notification_preferences
  add column if not exists email_marketing boolean not null default true;

comment on column public.notification_preferences.email_marketing is
  'Opt-in for promotional emails. Toggled off by the /unsubscribe link.';


-- ------------------------------------------------------------
-- 3) notification_preferences.unsubscribe_token
-- ------------------------------------------------------------
-- Each row gets a fresh random token on ALTER (Postgres 11+ back-
-- fills volatile defaults per row). New signups get one via the
-- table default.
alter table public.notification_preferences
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists notification_preferences_unsub_token_idx
  on public.notification_preferences (unsubscribe_token);


-- ------------------------------------------------------------
-- 4) campaign_redemptions
-- ------------------------------------------------------------
create table if not exists public.campaign_redemptions (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  text not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  redeemed_at  timestamptz not null default now(),
  unique (campaign_id, user_id)
);

alter table public.campaign_redemptions enable row level security;

-- A user may see their own redemptions (used by the offer page to
-- show "you already accepted this" without a second query).
drop policy if exists campaign_redemptions_own_select on public.campaign_redemptions;
create policy campaign_redemptions_own_select
  on public.campaign_redemptions for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy on purpose — only the service-role
-- (offer-accept + admin send routes) can write here.


-- ============================================================
-- End — marketing campaigns
-- ============================================================
