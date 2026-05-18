-- ============================================================
-- FlipWork — Messaging trigger patch
-- The original trigger looked up gigs.created_by, but the app uses
-- gigs.poster_user_id as the canonical "who posted this" field.
-- This patch updates the trigger to prefer poster_user_id, falling
-- back to created_by, and backfills any conversations that were
-- missed by the original backfill.
-- ============================================================

create or replace function public.create_conversation_on_claim()
returns trigger
language plpgsql
security definer
as $$
declare
  v_poster uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select coalesce(poster_user_id, created_by) into v_poster
    from public.gigs
    where id = new.gig_id;

  if v_poster is null then
    return new;
  end if;

  insert into public.gig_conversations (gig_id, flipper_user_id, worker_user_id)
  values (new.gig_id, v_poster, new.worker_user_id)
  on conflict (gig_id) do nothing;

  return new;
end;
$$;

-- Backfill any active claims we may have missed (gigs where created_by was null
-- but poster_user_id is set)
insert into public.gig_conversations (gig_id, flipper_user_id, worker_user_id)
select c.gig_id, coalesce(g.poster_user_id, g.created_by), c.worker_user_id
from public.gig_claims c
join public.gigs g on g.id = c.gig_id
where c.status = 'active'
  and coalesce(g.poster_user_id, g.created_by) is not null
on conflict (gig_id) do nothing;
