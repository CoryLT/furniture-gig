-- ============================================================
-- FLIPWORK-MIGRATE-02  —  CONTACTS redo  —  2026-06-17
-- ============================================================
-- Last session's contacts insert never committed (a "Failed to fetch"
-- dashboard glitch ate it). A count came back 0. This re-creates the 5
-- people cleanly, stamped to Cory's account, then shows the count in the
-- same run so you can see it worked.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary database,
-- in a FRESH / incognito window (dodges the stuck read-replica bug).
--
-- DO NOT run this twice — it would make duplicate people. If you ever need
-- a clean redo, run this first:   delete from public.contacts;
-- (Only your rows exist, so that's safe.)
--
-- NOTE (discovered 2026-06-17): last session's prep never actually took —
-- the strict type rule was still on the table and tax_id was missing. So
-- this file now also does those two prep bits up top. Both are idempotent.
-- It does NOT clear the ledger (that's a separate decision).
-- ============================================================

-- make the contacts table the right shape (prep that didn't stick last time)
alter table public.contacts drop constraint if exists contacts_type_check;
alter table public.contacts add column if not exists tax_id text;

-- now add the 5 people
insert into public.contacts (owner_user_id, name, type)
values
  ('72f34512-113f-4c02-b638-0ddf3236d2a9', 'Nick Lynch',           'contractor'),
  ('72f34512-113f-4c02-b638-0ddf3236d2a9', 'Wake County',          'vendor'),
  ('72f34512-113f-4c02-b638-0ddf3236d2a9', 'Craigslist',           'vendor'),
  ('72f34512-113f-4c02-b638-0ddf3236d2a9', 'Supabase',             'vendor'),
  ('72f34512-113f-4c02-b638-0ddf3236d2a9', 'Capital Nursing Home', 'customer');

-- show the result right away
select count(*) as contact_count from public.contacts;

-- ============================================================
-- End FLIPWORK-MIGRATE-02
-- ============================================================
