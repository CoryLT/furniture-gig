-- ============================================================
-- FlipWork — Application / Approval flow refactor
-- ============================================================
-- This migration switches the "first to claim wins" model to a
-- proper application/approval flow:
--   - Workers APPLY (status = 'pending')
--   - Flipper picks one → that application becomes 'active'
--   - All other pending applications for that gig auto-flip to 'rejected'
--   - Messaging opens as soon as a worker applies (pre-pick screening)
--   - When rejected, a system message is posted to the conversation
--
-- Paste this whole file into the Supabase SQL editor and run it.
-- It is idempotent — safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. gig_claims: allow multiple applications per gig
-- ------------------------------------------------------------
-- The old model was one row per gig. The new model is one row per
-- (gig, worker), so we drop the old UNIQUE on gig_id and add a
-- composite UNIQUE on (gig_id, worker_user_id) so a worker can't
-- apply twice to the same gig.

-- Drop the old constraint (its name comes from "unique" on the column
-- in the original CREATE TABLE, which Postgres named gig_claims_gig_id_key)
alter table public.gig_claims
  drop constraint if exists gig_claims_gig_id_key;

-- Some installs may have created the unique as an index instead
drop index if exists public.gig_claims_gig_id_key;

-- Add the new composite uniqueness
alter table public.gig_claims
  drop constraint if exists gig_claims_gig_worker_unique;

alter table public.gig_claims
  add constraint gig_claims_gig_worker_unique
  unique (gig_id, worker_user_id);

-- Add 'pending' to the allowed status values
alter table public.gig_claims
  drop constraint if exists gig_claims_status_check;

alter table public.gig_claims
  add constraint gig_claims_status_check
  check (status in (
    'pending',
    'active',
    'submitted_for_review',
    'approved',
    'rejected',
    'cancelled'
  ));

-- Helpful index for "show me all applicants for this gig"
create index if not exists idx_gig_claims_gig_status
  on public.gig_claims(gig_id, status);


-- ------------------------------------------------------------
-- 2. gig_conversations: allow one conversation per (gig, worker)
-- ------------------------------------------------------------
-- Was: one conversation per gig.
-- Now: one conversation per (gig, applicant) so the flipper can
-- chat with each applicant separately before picking.

alter table public.gig_conversations
  drop constraint if exists gig_conversations_gig_id_key;

drop index if exists public.gig_conversations_gig_id_key;

alter table public.gig_conversations
  drop constraint if exists gig_conversations_gig_worker_unique;

alter table public.gig_conversations
  add constraint gig_conversations_gig_worker_unique
  unique (gig_id, worker_user_id);


-- ------------------------------------------------------------
-- 3. Update the auto-create-conversation trigger
-- ------------------------------------------------------------
-- Old: fires only when claim.status = 'active'
-- New: fires when claim.status = 'pending' OR 'active'
-- (Conversations should exist as soon as someone applies.)

create or replace function public.create_conversation_on_claim()
returns trigger
language plpgsql
security definer
as $$
declare
  v_poster uuid;
begin
  if new.status not in ('pending', 'active') then
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
  on conflict (gig_id, worker_user_id) do nothing;

  return new;
end;
$$;


-- ------------------------------------------------------------
-- 4. Approval function: pick one applicant, reject the rest
-- ------------------------------------------------------------
-- Called by the flipper from their dashboard. In one transaction:
--   - The chosen application flips to 'active'
--   - The gig.status flips to 'claimed'
--   - All OTHER pending applications for this gig flip to 'rejected'
--   - A system message is posted to each rejected conversation
--
-- Only the gig poster (or admin) can call this. Security is enforced
-- by checking the caller against the gig's poster.

create or replace function public.approve_applicant(p_claim_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_gig_id        uuid;
  v_worker_id     uuid;
  v_poster_id     uuid;
  v_caller_id     uuid;
  v_caller_role   text;
  rejected_row    record;
  v_conv_id       uuid;
  v_system_body   text := 'This gig was assigned to another worker. Thanks for applying!';
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Load the application and its gig
  select c.gig_id, c.worker_user_id
    into v_gig_id, v_worker_id
    from public.gig_claims c
    where c.id = p_claim_id;

  if v_gig_id is null then
    raise exception 'Application not found';
  end if;

  -- Caller must be the gig poster, or an admin
  select coalesce(poster_user_id, created_by) into v_poster_id
    from public.gigs
    where id = v_gig_id;

  select role into v_caller_role
    from public.users
    where id = v_caller_id;

  if v_caller_id <> v_poster_id and v_caller_role <> 'admin' then
    raise exception 'Only the gig poster can approve applicants';
  end if;

  -- Approve the chosen one
  update public.gig_claims
    set status = 'active', updated_at = now()
    where id = p_claim_id;

  -- Lock the gig
  update public.gigs
    set status = 'claimed', updated_at = now()
    where id = v_gig_id;

  -- Reject every OTHER pending applicant for this gig
  -- and post a system message into each rejected applicant's conversation.
  for rejected_row in
    select id, worker_user_id
      from public.gig_claims
      where gig_id = v_gig_id
        and id <> p_claim_id
        and status = 'pending'
  loop
    update public.gig_claims
      set status = 'rejected', updated_at = now()
      where id = rejected_row.id;

    -- Find the conversation for this rejected applicant
    select id into v_conv_id
      from public.gig_conversations
      where gig_id = v_gig_id
        and worker_user_id = rejected_row.worker_user_id;

    if v_conv_id is not null then
      insert into public.gig_messages (conversation_id, sender_user_id, body)
      values (v_conv_id, v_poster_id, v_system_body);
    end if;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 5. Reject function: reject a single applicant
-- ------------------------------------------------------------
-- Used when the flipper wants to reject one applicant without
-- picking anyone else yet. Also posts a system message.

create or replace function public.reject_applicant(p_claim_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_gig_id      uuid;
  v_worker_id   uuid;
  v_poster_id   uuid;
  v_caller_id   uuid;
  v_caller_role text;
  v_conv_id     uuid;
  v_system_body text := 'This gig was assigned to another worker. Thanks for applying!';
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.gig_id, c.worker_user_id
    into v_gig_id, v_worker_id
    from public.gig_claims c
    where c.id = p_claim_id;

  if v_gig_id is null then
    raise exception 'Application not found';
  end if;

  select coalesce(poster_user_id, created_by) into v_poster_id
    from public.gigs
    where id = v_gig_id;

  select role into v_caller_role
    from public.users
    where id = v_caller_id;

  if v_caller_id <> v_poster_id and v_caller_role <> 'admin' then
    raise exception 'Only the gig poster can reject applicants';
  end if;

  update public.gig_claims
    set status = 'rejected', updated_at = now()
    where id = p_claim_id;

  select id into v_conv_id
    from public.gig_conversations
    where gig_id = v_gig_id
      and worker_user_id = v_worker_id;

  if v_conv_id is not null then
    insert into public.gig_messages (conversation_id, sender_user_id, body)
    values (v_conv_id, v_poster_id, v_system_body);
  end if;
end;
$$;


-- ------------------------------------------------------------
-- 6. Grant execute on the new functions to authenticated users
-- ------------------------------------------------------------
grant execute on function public.approve_applicant(uuid) to authenticated;
grant execute on function public.reject_applicant(uuid) to authenticated;


-- ------------------------------------------------------------
-- 7. Backfill: convert existing 'active' claims to the new model
-- ------------------------------------------------------------
-- Existing claims with status='active' are fine — they remain active.
-- No backfill needed for them; they're already in a valid state.
-- New claims will be inserted with status='pending'.
