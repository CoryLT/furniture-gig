-- ============================================================
-- FlipWork — Drop the unused QuickBooks tables (OPTIONAL cleanup)
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- QuickBooks has been removed from FlipWork. Receipts now log straight
-- into your own Books. These three tables only ever held the QuickBooks
-- sandbox connection + settings, and nothing in the app reads them anymore.
--
-- This is OPTIONAL and PERMANENT. It deletes those tables and their rows
-- (which were sandbox-only, not your real books). Your Books data lives in
-- the `transactions` / `entry_lines` / `accounts` tables and is NOT touched.
--
-- Safe to run once. Skip it if you'd rather leave the empty tables alone.
-- ============================================================

drop table if exists public.quickbooks_synced       cascade;
drop table if exists public.quickbooks_settings      cascade;
drop table if exists public.quickbooks_connections   cascade;
