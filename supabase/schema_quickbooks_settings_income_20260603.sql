-- ============================================================
-- Add income mapping to QuickBooks settings — 2026-06-03
-- ============================================================
-- For sending a piece's SALE into QuickBooks as income:
--   income_account_id     = the income account the sale is booked to
--   deposit_to_account_id = the bank account the money lands in
--
-- Safe to re-run. Idempotent. Only adds columns.
-- ============================================================

alter table public.quickbooks_settings
  add column if not exists income_account_id text;

alter table public.quickbooks_settings
  add column if not exists deposit_to_account_id text;
