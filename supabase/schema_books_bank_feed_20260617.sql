-- ============================================================
-- FLIPWORK — books_bank_feed table  —  2026-06-17
-- ============================================================
-- Holds the imported bank lines that the reconcile screen works through.
-- Named with the books_ prefix on purpose, to avoid colliding with any
-- stray bank_feed table. Per-owner: you only ever see your own lines.
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- ============================================================

create table if not exists public.books_bank_feed (
  id              uuid primary key default uuid_generate_v4(),
  owner_user_id   uuid references public.users(id) on delete cascade not null,
  posted_date     date,
  amount          numeric(12,2) not null,
  source          text,
  status          text,
  handled         boolean not null default false,
  external_id     text,
  transaction_id  uuid,            -- set later when a line is reconciled into the ledger
  raw_description text,
  imported_at     timestamptz
);

create index if not exists books_bank_feed_owner_idx
  on public.books_bank_feed (owner_user_id, posted_date);

-- one bank line can't be imported twice for the same owner
create unique index if not exists books_bank_feed_owner_extid_uidx
  on public.books_bank_feed (owner_user_id, external_id);

alter table public.books_bank_feed enable row level security;

drop policy if exists "owner manages own bank feed" on public.books_bank_feed;
create policy "owner manages own bank feed"
  on public.books_bank_feed for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- ============================================================
-- End books_bank_feed
-- ============================================================
