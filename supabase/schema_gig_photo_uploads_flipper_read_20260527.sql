-- ============================================================
-- Let gig posters (flippers) view worker proof photos
-- 2026-05-27
-- ============================================================
-- Bug: when a worker uploads proof photos for a gig and submits
-- for review, the gig poster (flipper) goes to
-- /flipper/review/[claimId] and sees no photos.
--
-- Why: the original RLS on gig_photo_uploads only allowed:
--   1. The worker themselves to see their own uploads
--   2. Admin to see all uploads
-- There was no policy letting the gig poster see uploads attached
-- to their own gig. So the flipper's SELECT returned 0 rows and
-- the photos section silently didn't render.
--
-- Fix: add a SELECT policy that lets the user who posted the gig
-- read all photo uploads attached to that gig. This is read-only;
-- only the worker can still INSERT/UPDATE/DELETE their own.
--
-- Idempotent. Safe to re-run.
-- ============================================================

drop policy if exists "Gig posters can view proof photos on their gigs"
  on public.gig_photo_uploads;

create policy "Gig posters can view proof photos on their gigs"
  on public.gig_photo_uploads for select
  using (
    exists (
      select 1
        from public.gigs g
       where g.id = gig_photo_uploads.gig_id
         and coalesce(g.poster_user_id, g.created_by) = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- Report: list policies on the table so you can eyeball that
-- the new one is in place after running this.
-- ------------------------------------------------------------
select policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename  = 'gig_photo_uploads'
 order by policyname;
