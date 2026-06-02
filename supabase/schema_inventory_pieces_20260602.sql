-- ============================================================
-- Inventory Pieces — the heart of the resource-management loop — 2026-06-02
-- ============================================================
-- Each row is one piece you're flipping. It moves through stages:
--   sourced -> in_progress -> listed -> sold
--
-- The money fields let us compute profit per flip and the dashboard's
-- resource HUD (cash tied up in unsold pieces, profit this month, etc.):
--
--   profit  = sale_price - (acquisition_cost + materials_cost + labor_cost)
--   tied up = acquisition_cost + materials_cost + labor_cost   (while unsold)
--
-- labor_cost is a manual field for now; later we can auto-link it to the
-- crew payments recorded against this piece.
--
-- One owner per piece, private to that owner. Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.inventory_pieces (
  id                uuid primary key default uuid_generate_v4(),
  owner_user_id     uuid references public.users(id) on delete cascade not null,
  title             text not null default '',
  stage             text not null default 'sourced'
                      check (stage in ('sourced','in_progress','listed','sold')),
  source            text,                        -- where it came from (FB Marketplace, estate sale, curb...)
  acquisition_cost  numeric(10,2) not null default 0,   -- what you paid for the piece
  materials_cost    numeric(10,2) not null default 0,   -- paint, hardware, supplies
  labor_cost        numeric(10,2) not null default 0,   -- what you paid crew on it
  target_price      numeric(10,2),               -- what you're asking / expect to get
  sale_price        numeric(10,2),               -- what it actually sold for (set at 'sold')
  image_path        text,
  notes             text not null default '',
  acquired_at       date,
  listed_at         timestamptz,
  sold_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists inventory_pieces_owner_idx
  on public.inventory_pieces (owner_user_id, stage);

alter table public.inventory_pieces enable row level security;

-- You can read and write only your own pieces.
drop policy if exists "owner manages own pieces" on public.inventory_pieces;
create policy "owner manages own pieces"
  on public.inventory_pieces for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
