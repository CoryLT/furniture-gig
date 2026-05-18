-- ============================================================
-- FlipWork — Messaging Schema
-- Adds gig_conversations and gig_messages tables for in-app
-- messaging between a gig's flipper (creator) and the worker
-- who claimed it.
-- ============================================================

-- ============================================================
-- GIG CONVERSATIONS
-- One row per (gig + flipper + worker) trio.
-- Created when a gig is claimed.
-- ============================================================
create table if not exists public.gig_conversations (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid not null references public.gigs(id) on delete cascade,
  flipper_user_id uuid not null references public.users(id) on delete cascade,
  worker_user_id uuid not null references public.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  -- One conversation per gig (matches the exclusive-claim model)
  unique (gig_id)
);

create index if not exists idx_gig_conversations_flipper
  on public.gig_conversations(flipper_user_id);

create index if not exists idx_gig_conversations_worker
  on public.gig_conversations(worker_user_id);

alter table public.gig_conversations enable row level security;

-- Either side of the conversation can read it
create policy "Participants can view conversation"
  on public.gig_conversations for select
  using (
    auth.uid() = flipper_user_id
    or auth.uid() = worker_user_id
  );

-- Either side can create the conversation (usually the worker on claim,
-- or auto via trigger below)
create policy "Participants can create conversation"
  on public.gig_conversations for insert
  with check (
    auth.uid() = flipper_user_id
    or auth.uid() = worker_user_id
  );

-- Participants can update last_message_at
create policy "Participants can update conversation"
  on public.gig_conversations for update
  using (
    auth.uid() = flipper_user_id
    or auth.uid() = worker_user_id
  );

-- Admin can view all conversations
create policy "Admin can view all conversations"
  on public.gig_conversations for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ============================================================
-- GIG MESSAGES
-- One row per message sent.
-- ============================================================
create table if not exists public.gig_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.gig_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_gig_messages_conversation_created
  on public.gig_messages(conversation_id, created_at);

create index if not exists idx_gig_messages_unread
  on public.gig_messages(conversation_id, read_at)
  where read_at is null;

alter table public.gig_messages enable row level security;

-- Participants of the conversation can read messages in it
create policy "Participants can view messages"
  on public.gig_messages for select
  using (
    exists (
      select 1 from public.gig_conversations c
      where c.id = gig_messages.conversation_id
        and (c.flipper_user_id = auth.uid() or c.worker_user_id = auth.uid())
    )
  );

-- Participants can insert messages where they are the sender
create policy "Participants can send messages"
  on public.gig_messages for insert
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.gig_conversations c
      where c.id = gig_messages.conversation_id
        and (c.flipper_user_id = auth.uid() or c.worker_user_id = auth.uid())
    )
  );

-- Participants can mark messages as read (update read_at) — only for
-- messages they did NOT send (i.e., received messages).
create policy "Recipients can mark messages read"
  on public.gig_messages for update
  using (
    sender_user_id <> auth.uid()
    and exists (
      select 1 from public.gig_conversations c
      where c.id = gig_messages.conversation_id
        and (c.flipper_user_id = auth.uid() or c.worker_user_id = auth.uid())
    )
  );

-- Admin can view all messages
create policy "Admin can view all messages"
  on public.gig_messages for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ============================================================
-- TRIGGER: bump conversation.last_message_at on new message
-- ============================================================
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.gig_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_message
  on public.gig_messages;

create trigger trg_touch_conversation_on_message
  after insert on public.gig_messages
  for each row execute function public.touch_conversation_on_message();


-- ============================================================
-- TRIGGER: auto-create a conversation when a gig is claimed
-- (fires when a row is inserted into gig_claims)
-- ============================================================
create or replace function public.create_conversation_on_claim()
returns trigger
language plpgsql
security definer
as $$
declare
  v_creator uuid;
begin
  -- Only create a conversation for active claims
  if new.status <> 'active' then
    return new;
  end if;

  -- Look up the gig creator (flipper)
  select created_by into v_creator
    from public.gigs
    where id = new.gig_id;

  if v_creator is null then
    return new;
  end if;

  -- Insert conversation row (UNIQUE on gig_id means this is a no-op if
  -- a conversation already exists for this gig)
  insert into public.gig_conversations (gig_id, flipper_user_id, worker_user_id)
  values (new.gig_id, v_creator, new.worker_user_id)
  on conflict (gig_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_create_conversation_on_claim
  on public.gig_claims;

create trigger trg_create_conversation_on_claim
  after insert on public.gig_claims
  for each row execute function public.create_conversation_on_claim();


-- ============================================================
-- BACKFILL: create conversations for gigs that are already claimed
-- ============================================================
insert into public.gig_conversations (gig_id, flipper_user_id, worker_user_id)
select c.gig_id, g.created_by, c.worker_user_id
from public.gig_claims c
join public.gigs g on g.id = c.gig_id
where c.status = 'active'
  and g.created_by is not null
on conflict (gig_id) do nothing;


-- ============================================================
-- REALTIME: enable realtime broadcasts on gig_messages and
-- gig_conversations so the chat UI can react instantly.
-- ============================================================
alter publication supabase_realtime add table public.gig_messages;
alter publication supabase_realtime add table public.gig_conversations;
