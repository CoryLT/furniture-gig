-- ============================================================
-- AI Support Chat tables
-- ============================================================
-- One row per support conversation. A user may have multiple
-- conversations over time. Each conversation has many messages.
--
-- Statuses:
--   active     -- currently open, user is chatting
--   resolved   -- user closed it OR AI decided it was resolved
--   escalated  -- AI flagged it for admin attention
--
-- Idempotent: safe to re-run.
-- ============================================================

create table if not exists support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'resolved', 'escalated')),
  summary text,                              -- short summary AI writes on escalate/resolve
  escalation_reason text,                    -- why AI escalated (legal, refund, bug, abuse, unknown)
  message_count int not null default 0,     -- denormalized count, capped at 50
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists support_conversations_user_idx
  on support_conversations(user_id, last_message_at desc);

create index if not exists support_conversations_status_idx
  on support_conversations(status, last_message_at desc);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_idx
  on support_messages(conversation_id, created_at asc);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table support_conversations enable row level security;
alter table support_messages enable row level security;

-- Conversations: user sees own, admin sees all
drop policy if exists "support_conversations_user_select" on support_conversations;
create policy "support_conversations_user_select"
  on support_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "support_conversations_admin_select" on support_conversations;
create policy "support_conversations_admin_select"
  on support_conversations for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

drop policy if exists "support_conversations_user_insert" on support_conversations;
create policy "support_conversations_user_insert"
  on support_conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "support_conversations_user_update" on support_conversations;
create policy "support_conversations_user_update"
  on support_conversations for update
  using (auth.uid() = user_id);

drop policy if exists "support_conversations_admin_update" on support_conversations;
create policy "support_conversations_admin_update"
  on support_conversations for update
  using (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

-- Messages: user sees own conversation's messages, admin sees all
drop policy if exists "support_messages_user_select" on support_messages;
create policy "support_messages_user_select"
  on support_messages for select
  using (
    exists (
      select 1 from support_conversations
      where support_conversations.id = support_messages.conversation_id
        and support_conversations.user_id = auth.uid()
    )
  );

drop policy if exists "support_messages_admin_select" on support_messages;
create policy "support_messages_admin_select"
  on support_messages for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

-- Inserts are done via server-side service-role client only.
-- (The API route writes both user and assistant messages with
-- admin client to bypass RLS — simpler than maintaining two
-- separate policies for user vs assistant role inserts.)

-- ------------------------------------------------------------
-- Trigger: bump last_message_at + message_count when a new
-- message is inserted.
-- ------------------------------------------------------------
create or replace function bump_support_conversation_on_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update support_conversations
    set last_message_at = new.created_at,
        message_count = message_count + 1,
        updated_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_support_conversation on support_messages;
create trigger trg_bump_support_conversation
  after insert on support_messages
  for each row
  execute function bump_support_conversation_on_message();
