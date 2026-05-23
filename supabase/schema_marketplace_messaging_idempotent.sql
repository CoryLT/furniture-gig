-- ============================================================
-- FlipWork — Marketplace messaging (IDEMPOTENT)
-- ============================================================
-- Same content as schema_marketplace_messaging.sql, but every
-- CREATE POLICY is preceded by a DROP POLICY IF EXISTS, so it
-- can be re-run safely if a previous run partially completed.
--
-- Paste this whole file into Supabase SQL Editor → Run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. listing_conversations
-- ------------------------------------------------------------
create table if not exists public.listing_conversations (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null
    references public.marketplace_listings(id) on delete cascade,
  seller_user_id uuid not null
    references public.users(id) on delete cascade,
  buyer_user_id uuid not null
    references public.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_user_id),
  check (seller_user_id <> buyer_user_id)
);

create index if not exists idx_listing_conversations_seller
  on public.listing_conversations(seller_user_id, last_message_at desc);
create index if not exists idx_listing_conversations_buyer
  on public.listing_conversations(buyer_user_id, last_message_at desc);
create index if not exists idx_listing_conversations_listing
  on public.listing_conversations(listing_id);

alter table public.listing_conversations enable row level security;

drop policy if exists "Participants can view listing conversations"
  on public.listing_conversations;
create policy "Participants can view listing conversations"
  on public.listing_conversations for select
  using (
    auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Buyer can create listing conversation"
  on public.listing_conversations;
create policy "Buyer can create listing conversation"
  on public.listing_conversations for insert
  with check (auth.uid() = buyer_user_id);

drop policy if exists "Participants can update listing conversation"
  on public.listing_conversations;
create policy "Participants can update listing conversation"
  on public.listing_conversations for update
  using (
    auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Admin can view all listing conversations"
  on public.listing_conversations;
create policy "Admin can view all listing conversations"
  on public.listing_conversations for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- 2. listing_messages
-- ------------------------------------------------------------
create table if not exists public.listing_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null
    references public.listing_conversations(id) on delete cascade,
  sender_user_id uuid not null
    references public.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_listing_messages_conversation_created
  on public.listing_messages(conversation_id, created_at);
create index if not exists idx_listing_messages_unread
  on public.listing_messages(conversation_id, read_at)
  where read_at is null;

alter table public.listing_messages enable row level security;

drop policy if exists "Participants can read listing messages"
  on public.listing_messages;
create policy "Participants can read listing messages"
  on public.listing_messages for select
  using (
    exists (
      select 1 from public.listing_conversations c
      where c.id = listing_messages.conversation_id
        and (c.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid())
    )
  );

drop policy if exists "Participants can send listing messages"
  on public.listing_messages;
create policy "Participants can send listing messages"
  on public.listing_messages for insert
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.listing_conversations c
      where c.id = conversation_id
        and (c.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid())
    )
  );

drop policy if exists "Recipients can mark listing messages read"
  on public.listing_messages;
create policy "Recipients can mark listing messages read"
  on public.listing_messages for update
  using (
    sender_user_id <> auth.uid()
    and exists (
      select 1 from public.listing_conversations c
      where c.id = listing_messages.conversation_id
        and (c.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid())
    )
  );

drop policy if exists "Admin can view all listing messages"
  on public.listing_messages;
create policy "Admin can view all listing messages"
  on public.listing_messages for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- 3. Trigger — bump last_message_at on the parent conversation
-- ------------------------------------------------------------
create or replace function public.bump_listing_conversation_last_message()
returns trigger language plpgsql security definer as $$
begin
  update public.listing_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_listing_messages_bump_conversation
  on public.listing_messages;
create trigger trg_listing_messages_bump_conversation
  after insert on public.listing_messages
  for each row execute function public.bump_listing_conversation_last_message();


-- ------------------------------------------------------------
-- 4. Realtime publication
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listing_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.listing_messages';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listing_conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.listing_conversations';
  end if;
end $$;


-- ------------------------------------------------------------
-- 5. listing_reports
-- ------------------------------------------------------------
create table if not exists public.listing_reports (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null
    references public.marketplace_listings(id) on delete cascade,
  reporter_user_id uuid references public.users(id) on delete set null,
  reason_category text not null default 'other',
  reason_detail text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'resolved_removed', 'resolved_kept', 'dismissed')),
  admin_notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_listing_reports_status
  on public.listing_reports(status, created_at desc);
create index if not exists idx_listing_reports_listing
  on public.listing_reports(listing_id);
create index if not exists idx_listing_reports_reporter
  on public.listing_reports(reporter_user_id);

alter table public.listing_reports enable row level security;

drop policy if exists "Authenticated can insert listing reports"
  on public.listing_reports;
create policy "Authenticated can insert listing reports"
  on public.listing_reports for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "Reporter can view own listing reports"
  on public.listing_reports;
create policy "Reporter can view own listing reports"
  on public.listing_reports for select
  using (auth.uid() = reporter_user_id);

drop policy if exists "Admin can view all listing reports"
  on public.listing_reports;
create policy "Admin can view all listing reports"
  on public.listing_reports for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

drop policy if exists "Admin can update listing reports"
  on public.listing_reports;
create policy "Admin can update listing reports"
  on public.listing_reports for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ============================================================
-- DONE — safe to re-run any time
-- ============================================================
