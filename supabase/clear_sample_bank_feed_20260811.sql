-- ============================================================
-- FLIPWORK — clear old sample bank-feed rows out of reconcile
-- 2026-08-11
--
-- 56 unsorted lines in reconcile are development sample data (external_id
-- 'csv:%', source 'business checking', dated May–June 2026). They duplicate
-- the real statement, so we DISMISS them (handled = true) instead of posting
-- them — no ledger entry is created, nothing is double-counted, and the real
-- books are untouched. This only clears them from the reconcile queue.
--
-- Run in the FlipWork Web App Supabase project, Primary db. Safe to re-run.
-- ============================================================

update public.books_bank_feed f
set handled = true,
    status  = 'dismissed'
from auth.users u
where u.id = f.owner_user_id
  and lower(u.email) in ('corythacker@gmail.com', 'corythacker@proton.me')
  and f.handled = false
  and f.external_id like 'csv:%';

-- Confirm what's left unsorted (should be 0, or only real relay/wellsfargo lines):
select coalesce(f.source, '(none)')       as source,
       split_part(f.external_id, ':', 1)  as came_from,
       count(*)                           as lines
from public.books_bank_feed f
join auth.users u on u.id = f.owner_user_id
where lower(u.email) in ('corythacker@gmail.com', 'corythacker@proton.me')
  and f.handled = false
group by 1, 2
order by lines desc;
