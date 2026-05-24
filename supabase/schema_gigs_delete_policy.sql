-- ============================================================
-- Allow gig posters to DELETE their own gigs
-- ============================================================
-- Background: schema.sql + schema_v2_additions.sql gave gig posters
-- INSERT / UPDATE / SELECT policies on the gigs table, but never a
-- DELETE policy. The admin "for all" policy covers admins, so admin
-- deletes work today, but a regular flipper trying to delete their
-- own gig is silently blocked by RLS (delete affects 0 rows, no
-- error). The new /api/gigs/[id]/delete endpoint needs this policy
-- to actually work for normal users.
--
-- We use coalesce(poster_user_id, created_by) to match the pattern
-- used elsewhere (some older gig rows have created_by but no
-- poster_user_id).
-- ============================================================

drop policy if exists "Users can delete their own gigs" on public.gigs;

create policy "Users can delete their own gigs"
  on public.gigs for delete
  using (
    auth.uid() is not null
    and coalesce(poster_user_id, created_by) = auth.uid()
  );
