-- Fix part 2: gig posters must also be able to read the worker_profiles of
-- people who applied to their gigs.
--
-- The flipper gig page does:
--   .from('gig_claims').select('*, worker_profiles(...)')
--
-- Even though the previous patch lets posters read the claim row, the embedded
-- worker_profiles join silently returns null when RLS blocks the join target.
-- That caused the applicant list to come up empty even with the claim visible.
--
-- This policy allows the gig poster to SELECT a worker_profiles row if that
-- worker has a claim on one of the poster's gigs.

drop policy if exists "Posters can view applicant profiles" on public.worker_profiles;

create policy "Posters can view applicant profiles"
  on public.worker_profiles for select
  using (
    exists (
      select 1
      from public.gig_claims gc
      join public.gigs g on g.id = gc.gig_id
      where gc.worker_user_id = worker_profiles.user_id
        and coalesce(g.poster_user_id, g.created_by) = auth.uid()
    )
  );
