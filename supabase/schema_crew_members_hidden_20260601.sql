-- ============================================================
-- Crew Members: add "hidden" flag — 2026-06-01
-- ============================================================
-- The My Crew list is built from real work history (who you picked and
-- paid), so we can't truly "delete" a worker — that history is the basis
-- of their track record and the tax records. Instead, "Remove from list"
-- sets this hidden flag: it takes them off your crew list but keeps the
-- records intact, and you can restore them later.
--
-- Safe to re-run. Idempotent.
-- ============================================================

alter table public.crew_members
  add column if not exists hidden boolean not null default false;
