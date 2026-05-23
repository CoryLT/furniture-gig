-- ============================================================
-- STRIPE CONNECT PHASE 4: poster can update claim status during review
--
-- Background:
--   gig_claims has UPDATE policies for the worker (own claims) and
--   admin (everything), but NOT the gig poster. The flipper needs
--   to flip a submitted_for_review claim into either 'approved' (when
--   they accept the work) or back to 'active' (send back for revision).
--   Without this policy, those updates silently fail under RLS — the
--   client-side .update() call returns no error and no rows change.
--
-- What this adds:
--   A policy that lets the poster of a gig UPDATE a claim row on that
--   gig, but only when the row's current status is 'submitted_for_review'.
--   That keeps the policy narrow — flippers can't reach in and modify
--   claims at other points in the workflow.
--
-- Safe to re-run.
-- ============================================================

drop policy if exists "Posters can update claims under review" on public.gig_claims;

create policy "Posters can update claims under review"
  on public.gig_claims
  for update
  using (
    -- caller must be the poster of the gig this claim belongs to
    exists (
      select 1
      from public.gigs g
      where g.id = gig_claims.gig_id
        and coalesce(g.poster_user_id, g.created_by) = auth.uid()
    )
    -- and the claim must currently be in the review state
    and gig_claims.status = 'submitted_for_review'
  )
  with check (
    -- when updating, the caller still has to be the poster
    exists (
      select 1
      from public.gigs g
      where g.id = gig_claims.gig_id
        and coalesce(g.poster_user_id, g.created_by) = auth.uid()
    )
    -- and the new status can only be one of: approved, active
    -- (active = "send back for revision")
    and gig_claims.status in ('approved', 'active')
  );

-- ============================================================
-- DONE
-- ============================================================
