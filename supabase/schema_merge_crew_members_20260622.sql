-- ============================================================
-- FLIPWORK — merge_crew_members: fold one crew record into another  —  2026-06-22
-- ============================================================
-- The same person can end up as TWO crew records: one account-linked
-- ("on-platform", left over from the old gig/Stripe days) and one name-only
-- ("off-platform"), with labor payments split between them. This re-tags every
-- payment from the "from" record onto the "to" record, carries over a rating /
-- notes / rehire answer if the kept record is missing one, then removes the
-- leftover record. Money is preserved — it just all points at one person now.
--
-- Owner-scoped: a user can only touch their OWN crew + transactions.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

create or replace function public.merge_crew_members(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $mcm$
declare
  v_uid uuid := auth.uid();
  v_from_owner uuid;
  v_to_owner uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_from is null or p_to is null then raise exception 'Pick two people.'; end if;
  if p_from = p_to then raise exception 'Those are the same record.'; end if;

  -- Both records must belong to the signed-in operator.
  select operator_user_id into v_from_owner from public.crew_members where id = p_from;
  select operator_user_id into v_to_owner   from public.crew_members where id = p_to;
  if v_from_owner is null or v_from_owner <> v_uid then raise exception 'Not your crew.'; end if;
  if v_to_owner   is null or v_to_owner   <> v_uid then raise exception 'Not your crew.'; end if;

  -- 1) Re-tag every payment from the leftover record onto the kept one.
  update public.transactions
     set crew_member_id = p_to
   where crew_member_id = p_from
     and owner_user_id = v_uid;

  -- 2) Carry over rating / notes / rehire only where the kept record is blank,
  --    plus fold the legacy counters so nothing is lost.
  update public.crew_members tgt
     set rating       = coalesce(tgt.rating, src.rating),
         notes        = case when coalesce(tgt.notes, '') = '' then src.notes else tgt.notes end,
         would_rehire = coalesce(tgt.would_rehire, src.would_rehire),
         jobs_count   = coalesce(tgt.jobs_count, 0) + coalesce(src.jobs_count, 0),
         paid_total   = coalesce(tgt.paid_total, 0) + coalesce(src.paid_total, 0),
         updated_at   = now()
    from public.crew_members src
   where tgt.id = p_to and src.id = p_from
     and tgt.operator_user_id = v_uid and src.operator_user_id = v_uid;

  -- 3) Remove the leftover record (its payments are already re-tagged).
  delete from public.crew_members where id = p_from and operator_user_id = v_uid;
end
$mcm$;

-- ============================================================
-- End — merge_crew_members
-- ============================================================
