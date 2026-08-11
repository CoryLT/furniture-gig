-- ============================================================
-- FLIPWORK — add the missing subscriptions.comp_expires_at column
-- 2026-08-11
--
-- The plan-loading code (lib/plan.ts -> getPlan) selects comp_expires_at, but
-- that column was never added to the live subscriptions table. A select on a
-- missing column errors, so getPlan returns nothing and EVERY non-admin
-- account is treated as free — even with is_founding = true. Adding the
-- column makes the plan read succeed, so founding/comped accounts get Pro.
--
-- Run in the FlipWork Web App Supabase project, Primary db. Safe to re-run.
-- ============================================================

alter table public.subscriptions
  add column if not exists comp_expires_at timestamptz;

-- Confirm the column now exists:
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'subscriptions'
  and column_name = 'comp_expires_at';
