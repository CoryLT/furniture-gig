-- ============================================================
-- Add 'purchase' to the allowed piece_expenses categories — 2026-06-03
-- ============================================================
-- The category column had a CHECK that only allowed
-- materials / labor / transport / fees / other. This adds
-- 'purchase' (the cost to buy the piece itself) so it can be
-- logged as a line item in the expense ledger.
--
-- Safe to re-run. Idempotent. No data changes — only widens the rule.
-- ============================================================

alter table public.piece_expenses
  drop constraint if exists piece_expenses_category_check;

alter table public.piece_expenses
  add constraint piece_expenses_category_check
  check (category in ('purchase','materials','labor','transport','fees','other'));
