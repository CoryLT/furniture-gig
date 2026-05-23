-- ============================================================
-- STRIPE CONNECT PHASE 3 — authorize on pick
-- ============================================================
-- Adds:
--  1. RLS policy so flippers can see payout_records for gigs they posted
--  2. Index on flipper_user_id for faster lookup
--
-- Safe to re-run. Uses IF NOT EXISTS / drop-create where needed.
-- ============================================================

-- 1) Index on flipper_user_id for flipper-side lookups
create index if not exists payout_records_flipper_user_id_idx
  on public.payout_records (flipper_user_id)
  where flipper_user_id is not null;

-- 2) RLS: flippers can SELECT payout_records where they're the flipper
-- (workers + admin already have policies; this adds the flipper read path)
drop policy if exists "Flippers can view their own payout records"
  on public.payout_records;

create policy "Flippers can view their own payout records"
  on public.payout_records for select
  using (auth.uid() = flipper_user_id);

-- ============================================================
-- DONE
-- ============================================================
