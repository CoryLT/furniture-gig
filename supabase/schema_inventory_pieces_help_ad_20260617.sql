-- ============================================================
-- FlipWork — "Find help" ad maker: remember the ad on each piece
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- The "Find help" button on a piece asks a few questions (what needs
-- doing, pay, area, timeline, how to apply) and turns them into a
-- copy/paste ad for Craigslist or Facebook. We save those answers
-- right on the piece so the ad reopens later for re-copying or tweaking.
--
-- One JSON blob, shaped like:
--   {
--     "what":     "paint and new hardware",
--     "pay":      "$80",
--     "area":     "Charlotte, NC",
--     "timeline": "this week",
--     "apply":    "reply" | "phone",
--     "phone":    "704-555-1234",
--     "updated_at": "2026-06-17T00:00:00.000Z"
--   }
--
-- Safe to re-run. Idempotent.
-- ============================================================

alter table public.inventory_pieces
  add column if not exists help_ad jsonb;
