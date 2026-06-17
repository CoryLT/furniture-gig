-- ============================================================
-- FLIPWORK — books_inventory_items table  —  2026-06-17
-- ============================================================
-- Your supplies/hardware stock (knobs, pulls, legs, slides...).
-- books_ prefix so it can't collide with any stray inventory_items table.
-- Per-owner: you only see your own stock.
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- ============================================================

create table if not exists public.books_inventory_items (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  name          text not null default '',
  unit          text,
  avg_cost      numeric not null default 0,   -- kept full precision (averages)
  quantity      numeric not null default 0,
  image_path    text,
  reorder_level numeric,
  created_at    timestamptz not null default now()
);

create index if not exists books_inventory_items_owner_idx
  on public.books_inventory_items (owner_user_id);

alter table public.books_inventory_items enable row level security;

drop policy if exists "owner manages own inventory items" on public.books_inventory_items;
create policy "owner manages own inventory items"
  on public.books_inventory_items for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- ============================================================
-- End books_inventory_items
-- ============================================================
