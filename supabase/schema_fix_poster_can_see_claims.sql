-- Fix: Gig posters (flippers) must be able to see claims on their own gigs.
--
-- The original RLS on gig_claims only allowed the worker who owns the claim
-- and admins to SELECT. That meant flippers couldn't see who applied to their
-- own gigs — the dashboard claim count showed 0, and the applicant list on
-- /flipper/gigs/[id] came up empty even when applications existed.
--
-- This policy uses coalesce(poster_user_id, created_by) to match the same
-- pattern app code uses elsewhere for the dual gig-owner columns.

drop policy if exists "Posters can view claims on their gigs" on public.gig_claims;

create policy "Posters can view claims on their gigs"
  on public.gig_claims for select
  using (
    exists (
      select 1
      from public.gigs g
      where g.id = gig_claims.gig_id
        and coalesce(g.poster_user_id, g.created_by) = auth.uid()
    )
  );
