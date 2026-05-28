-- ============================================================
-- ADD COVER IMAGE TO WORKER SERVICES
-- Run this SQL in the Supabase SQL editor.
-- ============================================================
-- Adds a single optional cover image to each service. The value
-- is a file path inside the existing 'marketplace-photos' storage
-- bucket (the same bucket listing photos use). NULL means the
-- service has no image yet — existing services are unaffected.
-- ============================================================

alter table public.worker_services
  add column if not exists image_path text;
