-- ============================================================
-- Worker Payout Handles — 2026-05-30
-- ============================================================
-- Stores how each worker wants to be paid (Cash App, Venmo,
-- PayPal, Zelle). FlipWork does NOT move this money — the poster
-- pays the worker directly on whichever app the worker lists.
--
-- IMPORTANT: these handles live in their OWN table, NOT on
-- worker_profiles, because worker_profiles is publicly readable
-- (anyone can view a public profile). Pay handles must stay
-- private until a poster has actually booked the worker, so they
-- can't be scraped off public profiles.
--
-- RLS for now: a worker can read/write ONLY their own row. The
-- "a booked poster can read this worker's handles" policy gets
-- added later, when we build the poster-side pay step.
--
-- Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.worker_payout_handles (
  user_id    uuid primary key references public.users(id) on delete cascade,
  cashapp    text not null default '',   -- e.g. $cashtag
  venmo      text not null default '',   -- e.g. @handle
  paypal     text not null default '',   -- paypal.me link or email
  zelle      text not null default '',   -- phone or email
  preferred  text not null default ''
             check (preferred in ('', 'cashapp', 'venmo', 'paypal', 'zelle')),
  updated_at timestamptz not null default now()
);

alter table public.worker_payout_handles enable row level security;

-- A worker can see and edit only their own payout handles.
drop policy if exists "worker manages own payout handles" on public.worker_payout_handles;
create policy "worker manages own payout handles"
  on public.worker_payout_handles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.worker_payout_handles is
  'Private pay handles (Cash App/Venmo/PayPal/Zelle) for each worker. FlipWork does not process this money; the poster pays the worker directly. Kept off worker_profiles so handles are not exposed on public profiles.';
