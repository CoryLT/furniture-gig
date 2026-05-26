-- ============================================================
-- Notifications: gig_application — 2026-05-26
-- ============================================================
-- Adds the 'gig_application' notification type and a trigger that
-- creates one notification per new APPLICATION on a gig.
--
-- Trigger fires when:
--   • A new row is inserted into gig_claims with status = 'pending'
--   • OR an existing claim's status updates TO 'pending' (rare;
--     covers the case where a claim is re-applied somehow)
--
-- Recipient: the gig poster (gigs.poster_user_id)
-- Actor:     the worker who applied (gig_claims.worker_user_id)
-- Payload:   gig id, slug, title — so the bell can link to
--            /flipper/gigs/[id] and show the gig title in the row.
--
-- SECURITY DEFINER so the insert into notifications bypasses the
-- table's RLS (which deliberately has no client-side INSERT policy).
--
-- Idempotent. Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Extend the type CHECK on notifications to accept the new value
-- ------------------------------------------------------------
-- Postgres won't let us "add to" a CHECK in place — we drop and
-- recreate. There's only one CHECK on this table and we know its
-- shape from the original migration.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow',
    'gig_application'
  ));


-- ------------------------------------------------------------
-- 2) Trigger function
-- ------------------------------------------------------------
create or replace function public.create_gig_application_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poster_user_id uuid;
  v_gig_title      text;
  v_gig_slug       text;
begin
  -- Only fire when the new/changed row is in 'pending' state.
  -- INSERTs with status != 'pending' (e.g. legacy 'active' inserts)
  -- and UPDATEs that touch other fields don't notify.
  if NEW.status is distinct from 'pending' then
    return NEW;
  end if;

  -- On UPDATE, only notify when the row JUST flipped INTO 'pending'
  -- (i.e. old status was not 'pending'). This stops spurious notifs
  -- when other fields on a pending row change.
  if TG_OP = 'UPDATE' then
    if OLD.status = 'pending' then
      return NEW;
    end if;
  end if;

  -- Look up the gig's poster + title + slug. If the gig is gone
  -- somehow (shouldn't happen because of FK cascades, but defend
  -- anyway), skip silently.
  select g.poster_user_id, g.title, g.slug
    into v_poster_user_id, v_gig_title, v_gig_slug
    from public.gigs g
   where g.id = NEW.gig_id;

  if v_poster_user_id is null then
    return NEW;
  end if;

  -- Defensive: a poster applying to their own gig shouldn't be
  -- possible (enforced elsewhere) but skip it if it slips through.
  if v_poster_user_id = NEW.worker_user_id then
    return NEW;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    data
  ) values (
    v_poster_user_id,
    NEW.worker_user_id,
    'gig_application',
    jsonb_build_object(
      'claim_id',  NEW.id,
      'gig_id',    NEW.gig_id,
      'gig_slug',  v_gig_slug,
      'gig_title', v_gig_title
    )
  );

  return NEW;
end;
$$;


-- ------------------------------------------------------------
-- 3) Trigger wiring on gig_claims
-- ------------------------------------------------------------
-- Drop + recreate so re-running this migration is safe.
drop trigger if exists gig_claims_create_application_notification on public.gig_claims;

create trigger gig_claims_create_application_notification
  after insert or update of status on public.gig_claims
  for each row
  execute function public.create_gig_application_notification();


-- ------------------------------------------------------------
-- 4) Report
-- ------------------------------------------------------------
select
  (select count(*) from public.notifications) as total_notifications,
  (select count(*) from public.notifications where type = 'gig_application') as gig_application_notifications;
