-- ============================================================
-- FlipWork — Founding Member badge
-- ============================================================
-- Adds a "founding member" flag to worker and flipper profiles.
-- First 25 workers and first 25 flippers get the badge.
--
-- Design:
--   - founding_member boolean column on each profile table
--   - founding_member_at timestamp for sort order
--   - A trigger on each profile table auto-grants the flag
--     to new rows IF the current count of founding members
--     is under the cap (25).
--   - Backfill: existing profiles get the flag in
--     created_at order, up to the cap.
--
-- Safe to re-run. Idempotent.
-- ============================================================

-- The cap. Change this here in one place if you want to bump it.
-- (Triggers below reference this via a function.)
create or replace function public.founding_member_cap()
returns int
language sql
immutable
as $$
  select 25
$$;

-- ------------------------------------------------------------
-- 1. WORKER PROFILES
-- ------------------------------------------------------------
alter table public.worker_profiles
  add column if not exists founding_member boolean not null default false,
  add column if not exists founding_member_at timestamptz;

-- Backfill: first 25 (by created_at) get the badge.
with ranked as (
  select id,
         row_number() over (order by created_at asc) as rn
    from public.worker_profiles
)
update public.worker_profiles wp
   set founding_member = true,
       founding_member_at = coalesce(wp.founding_member_at, now())
  from ranked r
 where wp.id = r.id
   and r.rn <= public.founding_member_cap()
   and wp.founding_member = false;

-- Trigger function: on insert, if we're under the cap, flag this row.
create or replace function public.grant_worker_founding_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  select count(*) into current_count
    from public.worker_profiles
   where founding_member = true;

  if current_count < public.founding_member_cap() then
    new.founding_member := true;
    new.founding_member_at := coalesce(new.founding_member_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_worker_founding_member on public.worker_profiles;
create trigger trg_worker_founding_member
  before insert on public.worker_profiles
  for each row
  execute function public.grant_worker_founding_member();


-- ------------------------------------------------------------
-- 2. FLIPPER PROFILES
-- ------------------------------------------------------------
alter table public.flipper_profiles
  add column if not exists founding_member boolean not null default false,
  add column if not exists founding_member_at timestamptz;

-- Backfill: first 25 (by created_at) get the badge.
with ranked as (
  select id,
         row_number() over (order by created_at asc) as rn
    from public.flipper_profiles
)
update public.flipper_profiles fp
   set founding_member = true,
       founding_member_at = coalesce(fp.founding_member_at, now())
  from ranked r
 where fp.id = r.id
   and r.rn <= public.founding_member_cap()
   and fp.founding_member = false;

-- Trigger function for flippers.
create or replace function public.grant_flipper_founding_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  select count(*) into current_count
    from public.flipper_profiles
   where founding_member = true;

  if current_count < public.founding_member_cap() then
    new.founding_member := true;
    new.founding_member_at := coalesce(new.founding_member_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_flipper_founding_member on public.flipper_profiles;
create trigger trg_flipper_founding_member
  before insert on public.flipper_profiles
  for each row
  execute function public.grant_flipper_founding_member();


-- ------------------------------------------------------------
-- 3. PUBLIC READ ACCESS FOR THE COUNTER
-- ------------------------------------------------------------
-- The landing page (logged-out!) shows "X of 25 spots left", so it
-- needs to be able to count founding members across both tables
-- without auth. We expose a function that returns just the counts.

create or replace function public.founding_member_counts()
returns table (
  workers_taken int,
  flippers_taken int,
  cap int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*)::int from public.worker_profiles where founding_member = true),
    (select count(*)::int from public.flipper_profiles where founding_member = true),
    public.founding_member_cap();
$$;

-- Allow anyone (anonymous + authenticated) to call this function.
grant execute on function public.founding_member_counts() to anon, authenticated;


-- ------------------------------------------------------------
-- 4. REPORT — verify what got applied
-- ------------------------------------------------------------
select
  'workers' as kind,
  (select count(*) from public.worker_profiles where founding_member = true) as founding_count,
  (select count(*) from public.worker_profiles) as total_count,
  public.founding_member_cap() as cap
union all
select
  'flippers' as kind,
  (select count(*) from public.flipper_profiles where founding_member = true) as founding_count,
  (select count(*) from public.flipper_profiles) as total_count,
  public.founding_member_cap() as cap;
