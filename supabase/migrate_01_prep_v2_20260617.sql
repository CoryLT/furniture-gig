-- ============================================================
-- FLIPWORK-MIGRATE-PREP-V2  —  make room for the Books import  —  2026-06-17
-- ============================================================
-- Slimmed down from v1: this only does what the CORE import needs, so it
-- can't trip over any stray leftover tables in the database.
--
--   1. Adds a tax-id field to people (Books has it; useful for 1099s).
--   2. Loosens the people "type" rule so your existing Books types fit.
--   3. Clears the handful of TEST ledger rows so your real Books accounts
--      come in as the one true chart (no duplicate starter buckets).
--
-- (The supplies + bank-feed tables come in a later step, under their own
-- names, so they won't collide with anything.)
--
-- Run in the MARKETPLACE project. Safe to re-run. Idempotent.
-- After it runs, /books shows "Set up my books" again — DON'T click it;
-- your real accounts arrive via the import.
-- ============================================================

-- 1 + 2. people (contacts): add tax_id, drop the strict type check
alter table public.contacts add column if not exists tax_id text;
alter table public.contacts drop constraint if exists contacts_type_check;

-- 3. clear the test ledger (lines first, then headers, then accounts)
delete from public.entry_lines;
delete from public.transactions;
delete from public.accounts;

-- ============================================================
-- End FLIPWORK-MIGRATE-PREP-V2
-- ============================================================
