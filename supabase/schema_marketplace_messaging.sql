-- ============================================================
-- FlipWork — Marketplace messaging
-- ============================================================
-- Adds listing_conversations + listing_messages, parallel to the
-- existing gig_conversations / gig_messages tables.
--
-- Why a sibling table instead of adding listing_id to gig_conversations:
--   * Existing gig messaging works and is well-tested — we don't
--     want to risk regressions.
--   * RLS rules differ: a listing conversation can be started by
--     ANY logged-in user who isn't the seller (no claim required).
--   * UNIQUE constraint differs: one conversation per (listing, buyer).
--   * The /messages inbox can union both sources in code.
--
-- This file is idempotent.
-- ============================================================


-- ------------------------------------------------------------
-- 1. listing_conversations
-- ------------------------------------------------------------
-- One row per (listing, interested buyer) pair.
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

  -- A buyer can only have ONE conversation per listing
  unique (listing_id, buyer_user_id),

  -- Sanity: seller and buyer must be different
  check (seller_user_id <> buyer_user_id)
);

create index if not exists idx_listing_conversations_seller
  on public.listing_conversations(seller_user_id, last_message_at desc);

create index if not exists idx_listing_conversations_buyer
  on public.listing_conversations(buyer_user_id, last_message_at desc);

create index if not exists idx_listing_conversations_listing
  on public.listing_conversations(listing_id);

alter table public.listing_conversations enable row level security;

-- Either participant can view their conversation
create policy "Participants can view listing conversations"
  on public.listing_conversations for select
  using (
    auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

-- Buyer creates the conversation. Seller doesn't initiate — they
-- get pinged when the first message arrives.
-- IMPORTANT: the WITH CHECK only enforces row-shape rules. We also
-- need to ensure the inserting user is NOT the seller. We do that
-- in the start API (server-side), AND with the seller_user_id <>
-- buyer_user_id constraint above.
create policy "Buyer can create listing conversation"
  on public.listing_conversations for insert
  with check (auth.uid() = buyer_user_id);

-- Participants can bump last_message_at via trigger; restrict UPDATE
-- to either side just in case.
create policy "Participants can update listing conversation"
  on public.listing_conversations for update
  using (
    auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

-- Admin can view all
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

-- Either participant of the parent conversation can read
create policy "Participants can read listing messages"
  on public.listing_messages for select
  using (
    exists (
      select 1 from public.listing_conversations c
      where c.id = listing_messages.conversation_id
        and (c.seller_user_id = auth.uid() or c.buyer_user_id = auth.uid())
    )
  );

-- Either participant can insert messages they are the sender of
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

-- The RECIPIENT (not sender) can mark their received messages read
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

-- Admin can view all
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
-- Add both tables to the supabase_realtime publication so the chat
-- client can subscribe to INSERT/UPDATE events. Wrapped in DO so
-- it doesn't error if already published.
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


-- ============================================================
-- DONE
-- ============================================================


-- ------------------------------------------------------------
-- 5. listing_reports
-- ------------------------------------------------------------
-- Lets ANY logged-in user flag a marketplace listing. Distinct
-- from image_reports because the issue may be the listing as a
-- whole (prohibited item, scam, misleading description), not a
-- specific photo.
create table if not exists public.listing_reports (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null
    references public.marketplace_listings(id) on delete cascade,
  reporter_user_id uuid references public.users(id) on delete set null,
  -- Free-form bucket: 'prohibited', 'scam', 'stolen', 'misleading',
  -- 'spam', 'other'
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

-- Any logged-in user can file a report (one per listing per user — we
-- don't strictly enforce uniqueness; duplicate reports are fine, admin
-- can dismiss as needed)
create policy "Authenticated can insert listing reports"
  on public.listing_reports for insert
  with check (auth.uid() = reporter_user_id);

-- Reporter can view their own
create policy "Reporter can view own listing reports"
  on public.listing_reports for select
  using (auth.uid() = reporter_user_id);

-- Admin can view + update everything
create policy "Admin can view all listing reports"
  on public.listing_reports for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "Admin can update listing reports"
  on public.listing_reports for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ============================================================
-- ALL DONE
-- ============================================================
