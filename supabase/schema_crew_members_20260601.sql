-- ============================================================
-- Crew Members — operator's private notes on their workers — 2026-06-01
-- ============================================================
-- This is the foundation of the "My Crew" roster.
--
-- The list of who's on your crew is ALREADY derivable from data we have:
-- it's every worker who has a claim on a gig you posted (gig_claims +
-- gigs.created_by), and their track record comes from gig_payments.
--
-- What we DON'T have yet is YOUR private layer on each of those people:
--   - a 1-5 rating
--   - free-text notes ("great with dressers, slow to reply", etc.)
--   - a "would rehire" yes/no flag
--
-- This table adds exactly that, and nothing else. One row per
-- (operator, worker) pair. It is PRIVATE to the operator — only the
-- person who wrote a note can read or change it. The worker never sees it.
--
-- Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.crew_members (
  id                uuid primary key default uuid_generate_v4(),
  operator_user_id  uuid references public.users(id) on delete cascade not null,
  worker_user_id    uuid references public.users(id) on delete cascade not null,
  rating            int check (rating between 1 and 5),     -- nullable: not rated yet
  notes             text not null default '',
  would_rehire      boolean,                                -- nullable: undecided
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (operator_user_id, worker_user_id)
);

-- Fast lookup of "all my crew notes" for the roster page.
create index if not exists crew_members_operator_idx
  on public.crew_members (operator_user_id);

alter table public.crew_members enable row level security;

-- The ONLY rule: you can read and write a crew note only if it's YOURS.
-- (operator_user_id = the logged-in user). This deliberately does NOT
-- check the worker against the users table — that read would false-fail
-- under users-table RLS, and the foreign keys already guarantee the IDs
-- are real.
drop policy if exists "operator manages own crew notes" on public.crew_members;
create policy "operator manages own crew notes"
  on public.crew_members for all
  using (operator_user_id = auth.uid())
  with check (operator_user_id = auth.uid());
