-- ============================================================
-- FLIPWORK — give the work account free-forever Pro (founding)
-- 2026-08-11
--
-- Cory signs in to the live app with corythacker@gmail.com (work), but the
-- admin email is corythacker@proton.me — so gmail was treated as a free user
-- and hit the Pro paywall. This flags the gmail account as "founding," which
-- unlocks ALL Pro features (receipts, tax export, payment records, statement
-- import) for that account, with no payment.
--
-- Run in the FlipWork Web App Supabase project, Primary db. Safe to re-run.
-- If nothing changes, make sure you've logged into the app at least once with
-- that email so its user row exists.
-- ============================================================

insert into public.subscriptions (user_id, status, is_founding)
select id, 'active', true
from public.users
where lower(email) = lower('corythacker@gmail.com')
on conflict (user_id) do update
  set is_founding = true,
      status      = 'active',
      updated_at  = now();

-- Check it worked — this should show is_founding = true for your gmail:
select u.email, s.status, s.is_founding
from public.users u
left join public.subscriptions s on s.user_id = u.id
where lower(u.email) = lower('corythacker@gmail.com');

-- ============================================================
-- End
-- ============================================================
