-- ============================================================
-- DIAGNOSTIC: worker_profiles name columns + username coverage
-- Read-only. This changes NOTHING. Safe to run.
-- Run all three blocks at once in the Supabase SQL Editor.
-- ============================================================

-- 1) Which name-related columns actually exist right now?
--    (Tells us if first_name / last_name are still real columns.)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'worker_profiles'
  and column_name in ('first_name', 'last_name', 'full_name', 'username')
order by column_name;

-- 2) How many workers have a name filled in, and how many have a username?
--    (full_name and username definitely exist, so this is safe.)
select
  count(*)                                                  as total_workers,
  count(*) filter (where coalesce(full_name, '') <> '')     as have_full_name,
  count(*) filter (where coalesce(username, '') <> '')      as have_username
from public.worker_profiles;

-- 3) The 10 most recent gig applicants and whether they have a
--    public profile (a username) + a display name.
select
  c.worker_user_id,
  c.status,
  c.claimed_at,
  wp.full_name,
  wp.username
from public.gig_claims c
left join public.worker_profiles wp on wp.user_id = c.worker_user_id
order by c.claimed_at desc
limit 10;
