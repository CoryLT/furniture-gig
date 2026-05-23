-- ============================================================
-- STRIPE CONNECT PHASE 3 — RLS fix for flipper INSERT/UPDATE
-- ============================================================
-- The /api/stripe/pick-worker route writes to payout_records on behalf
-- of the flipper (the logged-in user). The existing RLS policies only
-- let workers SELECT and admins do everything, so the flipper-side
-- insert was being silently blocked.
--
-- Add: flippers can INSERT and UPDATE rows where they are flipper_user_id.
-- Safe to re-run.
-- ============================================================

drop policy if exists "Flippers can insert their own payout records"
  on public.payout_records;

create policy "Flippers can insert their own payout records"
  on public.payout_records for insert
  with check (auth.uid() = flipper_user_id);

drop policy if exists "Flippers can update their own payout records"
  on public.payout_records;

create policy "Flippers can update their own payout records"
  on public.payout_records for update
  using (auth.uid() = flipper_user_id)
  with check (auth.uid() = flipper_user_id);

-- ============================================================
-- DONE
-- ============================================================
