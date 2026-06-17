-- ============================================================
-- FLIPWORK-MIGRATE-PREP-V1  —  make room for the Books import  —  2026-06-17
-- ============================================================
-- Run this in the MARKETPLACE project. It does four things, all prep:
--   1. Adds a tax-id field to people (Books has it; useful for 1099s).
--   2. Loosens the people "type" rule so your existing Books types fit.
--   3. Creates the supplies (inventory_items) and bank-feed tables.
--   4. Clears the handful of TEST ledger rows so your real Books accounts
--      come in as the one true chart (no duplicate starter buckets).
--
-- Note on step 4: the accounts/transactions/entry_lines tables only hold
-- your test entries right now (the books feature is brand new), so this is
-- safe. After it runs, /books will show "Set up my books" again until the
-- import lands — that's expected.
--
-- Safe to re-run. Idempotent.
-- ============================================================

-- 1 + 2. people (contacts): add tax_id, drop the strict type check
alter table public.contacts add column if not exists tax_id text;
alter table public.contacts drop constraint if exists contacts_type_check;

-- 3a. supplies inventory
create table if not exists public.inventory_items (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  name          text not null,
  unit          text,
  quantity      numeric(12,2) not null default 0,
  avg_cost      numeric(12,2) not null default 0,
  reorder_level numeric(12,2),
  image_path    text,
  created_at    timestamptz not null default now()
);
create index if not exists inventory_items_owner_idx on public.inventory_items (owner_user_id);
alter table public.inventory_items enable row level security;
drop policy if exists "owner manages own inventory items" on public.inventory_items;
create policy "owner manages own inventory items"
  on public.inventory_items for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- 3b. imported bank lines
create table if not exists public.bank_feed (
  id              uuid primary key default uuid_generate_v4(),
  owner_user_id   uuid references public.users(id) on delete cascade not null,
  external_id     text,
  source          text,
  posted_date     date,
  amount          numeric(12,2),
  raw_description  text,
  status          text,
  transaction_id  uuid references public.transactions(id) on delete set null,
  imported_at     timestamptz default now(),
  handled         boolean not null default false
);
create index if not exists bank_feed_owner_idx on public.bank_feed (owner_user_id);
create index if not exists bank_feed_txn_idx   on public.bank_feed (transaction_id);
alter table public.bank_feed enable row level security;
drop policy if exists "owner manages own bank feed" on public.bank_feed;
create policy "owner manages own bank feed"
  on public.bank_feed for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- 4. clear the test ledger (lines first, then headers, then accounts)
delete from public.entry_lines;
delete from public.transactions;
delete from public.accounts;

-- ============================================================
-- End FLIPWORK-MIGRATE-PREP-V1
-- ============================================================
