-- ============================================================
-- FLIPWORK — give the work account free-forever Pro (founding)
-- 2026-08-11  (v2 — match against auth.users, the real login table)
--
-- Run in the FlipWork Web App Supabase project, Primary db. Safe to re-run.
-- Comps BOTH of Cory's emails so whichever one he's logged in with is Pro.
-- ============================================================

insert into public.subscriptions (user_id, status, is_founding)
select id, 'active', true
from auth.users
where lower(email) in ('corythacker@gmail.com', 'corythacker@proton.me')
on conflict (user_id) do update
  set is_founding = true,
      status      = 'active',
      updated_at  = now();

-- Check it worked — you want is_founding = true next to your gmail:
select u.email, s.status, s.is_founding
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where lower(u.email) in ('corythacker@gmail.com', 'corythacker@proton.me');
