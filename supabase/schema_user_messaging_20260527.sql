-- ============================================================
-- FlipWork — User-to-User Messaging + Safeguards
-- ============================================================
-- A third messaging system, parallel to:
--   * gig_conversations / gig_messages       (poster <-> worker on a gig)
--   * listing_conversations / listing_messages (buyer <-> seller on a listing)
--
-- This one is for general user-to-user messages — triggered by
-- the "Contact Me" button on a public profile. Any logged-in
-- user can message any other logged-in user.
--
-- Safeguards:
--   * user_blocks  — a user can block another user; blocked users
--                    cannot start or post in a conversation with them.
--   * message_reports — a user can report a message; admin reviews.
--
-- NOT included (per product decision): a "new user" rate limit on
-- starting conversations.
--
-- This file is idempotent — safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. user_blocks (created FIRST because user_conversations
--    policies reference it)
-- ------------------------------------------------------------
create table if not exists public.user_blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  constraint user_blocks_no_self check (blocker_user_id <> blocked_user_id),
  unique (blocker_user_id, blocked_user_id)
);

create index if not exists idx_user_blocks_blocker
  on public.user_blocks(blocker_user_id);
create index if not exists idx_user_blocks_blocked
  on public.user_blocks(blocked_user_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can manage their own blocks"
  on public.user_blocks;
create policy "Users can manage their own blocks"
  on public.user_blocks for all
  using (auth.uid() = blocker_user_id)
  with check (auth.uid() = blocker_user_id);

drop policy if exists "Admin can view all blocks"
  on public.user_blocks;
create policy "Admin can view all blocks"
  on public.user_blocks for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- 2. user_conversations
-- ------------------------------------------------------------
-- One row per unique pair of users. We store the lower user id
-- as user_a_id and the higher as user_b_id (so the pair is
-- canonical) and enforce uniqueness on the pair.
create table if not exists public.user_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_a_id uuid not null references public.users(id) on delete cascade,
  user_b_id uuid not null references public.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  -- Canonical ordering: a < b. App must enforce on insert.
  constraint user_conversations_ordered check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);

create index if not exists idx_user_conversations_a
  on public.user_conversations(user_a_id);
create index if not exists idx_user_conversations_b
  on public.user_conversations(user_b_id);

alter table public.user_conversations enable row level security;

drop policy if exists "Participants can view user conversation"
  on public.user_conversations;
create policy "Participants can view user conversation"
  on public.user_conversations for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "Users can create a conversation they are in"
  on public.user_conversations;
create policy "Users can create a conversation they are in"
  on public.user_conversations for insert
  with check (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_user_id = user_a_id and b.blocked_user_id = user_b_id)
         or (b.blocker_user_id = user_b_id and b.blocked_user_id = user_a_id)
    )
  );

drop policy if exists "Participants can update user conversation"
  on public.user_conversations;
create policy "Participants can update user conversation"
  on public.user_conversations for update
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "Admin can view all user conversations"
  on public.user_conversations;
create policy "Admin can view all user conversations"
  on public.user_conversations for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- 3. user_messages
-- ------------------------------------------------------------
create table if not exists public.user_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null
    references public.user_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_messages_conv_created
  on public.user_messages(conversation_id, created_at);

create index if not exists idx_user_messages_unread
  on public.user_messages(conversation_id, read_at)
  where read_at is null;

alter table public.user_messages enable row level security;

drop policy if exists "Participants can view user messages"
  on public.user_messages;
create policy "Participants can view user messages"
  on public.user_messages for select
  using (
    exists (
      select 1 from public.user_conversations c
      where c.id = user_messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

drop policy if exists "Participants can send user messages"
  on public.user_messages;
create policy "Participants can send user messages"
  on public.user_messages for insert
  with check (
    auth.uid() = sender_user_id
    and exists (
      select 1 from public.user_conversations c
      where c.id = conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_user_id = c.user_a_id and b.blocked_user_id = c.user_b_id)
             or (b.blocker_user_id = c.user_b_id and b.blocked_user_id = c.user_a_id)
        )
    )
  );

drop policy if exists "Recipients can mark messages read"
  on public.user_messages;
create policy "Recipients can mark messages read"
  on public.user_messages for update
  using (
    sender_user_id <> auth.uid()
    and exists (
      select 1 from public.user_conversations c
      where c.id = user_messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

drop policy if exists "Admin can view all user messages"
  on public.user_messages;
create policy "Admin can view all user messages"
  on public.user_messages for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- 4. message_reports
-- ------------------------------------------------------------
-- A user can flag any message (user-to-user, gig, or listing) for
-- admin review. We store the source kind + source id rather than
-- a hard FK so all three messaging systems can be reported.
create table if not exists public.message_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  message_kind text not null
    check (message_kind in ('user', 'gig', 'listing')),
  message_id uuid not null,
  reason text not null default '',
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id)
);

create index if not exists idx_message_reports_status
  on public.message_reports(status);
create index if not exists idx_message_reports_message
  on public.message_reports(message_kind, message_id);

alter table public.message_reports enable row level security;

drop policy if exists "Users can create reports"
  on public.message_reports;
create policy "Users can create reports"
  on public.message_reports for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "Users can view their own reports"
  on public.message_reports;
create policy "Users can view their own reports"
  on public.message_reports for select
  using (auth.uid() = reporter_user_id);

drop policy if exists "Admin can view all reports"
  on public.message_reports;
create policy "Admin can view all reports"
  on public.message_reports for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

drop policy if exists "Admin can update reports"
  on public.message_reports;
create policy "Admin can update reports"
  on public.message_reports for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
