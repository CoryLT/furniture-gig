-- ============================================================
-- FlipWork — Off-platform crew members
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- Lets you keep a "file" on someone you hired in person who has no app
-- account (e.g. a friend who's awkward with apps). Such a crew member has
-- a name instead of a linked account, plus a running tally of jobs and
-- cash you've paid them.

-- A crew member can now be identified by a name when there's no account.
alter table public.crew_members
  alter column worker_user_id drop not null;

alter table public.crew_members
  add column if not exists worker_name text;

-- Running tallies for off-platform members (on-platform members get these
-- numbers computed live from claims/payments instead).
alter table public.crew_members
  add column if not exists jobs_count int not null default 0;

alter table public.crew_members
  add column if not exists paid_total numeric(10,2) not null default 0;

-- Every row must identify its worker one way or the other.
alter table public.crew_members
  drop constraint if exists crew_members_identity_chk;
alter table public.crew_members
  add constraint crew_members_identity_chk
    check (worker_user_id is not null or worker_name is not null);
