-- =====================================================================
-- Let flippers manage their own gig's checklist items.
--
-- Before this change, the RLS on gig_checklist_items only allowed:
--   - Any authenticated user to SELECT
--   - Only admins to INSERT/UPDATE/DELETE
--
-- That made sense when only admins could post gigs. Now any user can
-- post a gig and they need to be able to add a checklist when they
-- create or edit it. This migration adds a policy so the gig's poster
-- can manage its checklist items.
-- =====================================================================

-- Add a policy allowing the gig's poster to manage checklist items
-- on gigs they own. The existing admin policy stays in place.
create policy "Gig poster can manage their own checklist items"
  on public.gig_checklist_items for all
  using (
    exists (
      select 1 from public.gigs g
      where g.id = gig_checklist_items.gig_id
        and g.poster_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gigs g
      where g.id = gig_checklist_items.gig_id
        and g.poster_user_id = auth.uid()
    )
  );
