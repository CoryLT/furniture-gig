-- ============================================================
-- Repair: fix reconciled transaction descriptions — 2026-06-17
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- The reconcile screen had a bug where the Description box kept the
-- PREVIOUS line's text, so transactions got saved with the wrong
-- description. Reconcile still linked each transaction to the correct
-- bank line, so we can restore each description from its own line.
--
-- This only touches transactions that came from a reconciled bank line
-- (it leaves your manually-logged sales/expenses alone).
--
-- STEP 1 — PREVIEW (optional). Run just this SELECT first to see what
-- will change. If "current_description" already equals "correct_from_bank"
-- for a row, that row won't change. If your bank lines themselves all have
-- the same text, the descriptions will stay the same (that's the source
-- data, and you can rename any transaction on its own page).
-- ------------------------------------------------------------
select
  t.id,
  t.description                                              as current_description,
  btrim(regexp_replace(f.raw_description, '\s+', ' ', 'g'))  as correct_from_bank
from public.transactions t
join public.books_bank_feed f
  on f.transaction_id = t.id
 and f.owner_user_id  = t.owner_user_id
where f.raw_description is not null
  and btrim(f.raw_description) <> ''
order by t.date desc;

-- ------------------------------------------------------------
-- STEP 2 — THE FIX. Run this UPDATE to set each reconciled
-- transaction's description to its own bank line's text. Safe to
-- re-run; rows already correct just get set to the same value.
-- ------------------------------------------------------------
update public.transactions t
set description = btrim(regexp_replace(f.raw_description, '\s+', ' ', 'g'))
from public.books_bank_feed f
where f.transaction_id = t.id
  and f.owner_user_id  = t.owner_user_id
  and f.raw_description is not null
  and btrim(f.raw_description) <> '';
