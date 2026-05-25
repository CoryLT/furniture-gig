-- ============================================================
-- FlipWork — Welcome modal dismissal tracking
-- ============================================================
-- Adds a single timestamp column to users so we know who has
-- already seen the welcome modal. Null = hasn't seen it yet.
-- Set to now() when they click "Let's go!"
--
-- Backfill: any user who signed up MORE than 5 minutes ago is
-- marked as "already dismissed" so existing users don't get
-- bothered with the welcome modal. Only true newcomers see it.
--
-- Idempotent. Safe to re-run.
-- ============================================================

alter table public.users
  add column if not exists dismissed_welcome_modal_at timestamptz;

-- Backfill: mark every existing user as "already seen it" so we
-- don't show this to people who signed up before the feature shipped.
update public.users
   set dismissed_welcome_modal_at = now()
 where dismissed_welcome_modal_at is null
   and created_at < (now() - interval '5 minutes');

-- Report
select
  (select count(*) from public.users) as total_users,
  (select count(*) from public.users where dismissed_welcome_modal_at is not null) as already_dismissed,
  (select count(*) from public.users where dismissed_welcome_modal_at is null) as will_see_modal;
