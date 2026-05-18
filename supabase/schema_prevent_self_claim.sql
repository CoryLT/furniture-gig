-- ============================================================
-- FlipWork — Prevent users from claiming their own gigs
-- Adds a trigger that refuses an INSERT/UPDATE on gig_claims
-- if the worker_user_id matches the gig's poster.
-- ============================================================

create or replace function public.prevent_self_claim()
returns trigger
language plpgsql
as $$
declare
  v_poster uuid;
begin
  select coalesce(poster_user_id, created_by) into v_poster
    from public.gigs
    where id = new.gig_id;

  if v_poster is not null and v_poster = new.worker_user_id then
    raise exception 'You cannot claim a gig you posted.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_claim on public.gig_claims;

create trigger trg_prevent_self_claim
  before insert or update on public.gig_claims
  for each row execute function public.prevent_self_claim();


-- ============================================================
-- Clean up any existing self-claims that may already exist.
-- This deletes invalid claim rows where the worker is also the poster.
-- ============================================================
delete from public.gig_claims c
  using public.gigs g
  where c.gig_id = g.id
    and c.worker_user_id = coalesce(g.poster_user_id, g.created_by);

-- Reset gig status back to 'open' for gigs whose only claim was a self-claim
update public.gigs g
  set status = 'open'
  where g.status = 'claimed'
    and not exists (
      select 1 from public.gig_claims c
      where c.gig_id = g.id and c.status = 'active'
    );
