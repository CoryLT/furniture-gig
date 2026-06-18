-- ============================================================
-- Notifications: 1099_threshold — 2026-06-17
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- Adds the '1099_threshold' notification type so the app can alert an
-- operator the moment they've paid a single worker enough this year to
-- likely need a 1099 ($600 through 2025, $2,000 for 2026+).
--
-- The notification row itself is inserted server-side (the app route
-- uses the service role, since this table has no client INSERT policy).
-- This migration only widens the allowed `type` values.
--
-- Postgres can't add to a CHECK in place, so we drop + recreate it with
-- the full list. Safe to re-run. Idempotent.
-- ============================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow',
    'gig_application',
    '1099_threshold'
  ));
