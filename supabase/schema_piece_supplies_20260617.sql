-- ============================================================
-- FLIPWORK — use supplies on a piece  —  2026-06-17
-- ============================================================
-- Lets you "spend" supplies from your stock onto a piece.
-- Using a supply lowers its count and records WHAT went onto the piece
-- (with the cost at the time), so you can see what each piece really used.
-- It does NOT post a second ledger expense — the hardware was already
-- expensed when you bought it. This keeps every cost logged once.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

-- 1) Which supplies were used on which piece (snapshot the name + cost).
create table if not exists public.piece_supplies (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  piece_id      uuid references public.inventory_pieces(id) on delete cascade not null,
  item_id       uuid references public.books_inventory_items(id) on delete set null,
  item_name     text not null default '',
  unit_cost     numeric not null default 0,
  qty           numeric not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists piece_supplies_piece_idx on public.piece_supplies (piece_id);
create index if not exists piece_supplies_owner_idx on public.piece_supplies (owner_user_id);

alter table public.piece_supplies enable row level security;

drop policy if exists "owner manages own piece supplies" on public.piece_supplies;
create policy "owner manages own piece supplies"
  on public.piece_supplies for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- 2) Use a supply on a piece: lower the stock, record the usage snapshot.
create or replace function public.use_supply_on_piece(
  p_item_id uuid, p_piece_id uuid, p_qty numeric
) returns table(
  usage_id uuid, item_name text, unit_cost numeric, qty numeric,
  new_quantity numeric, is_low boolean, reorder_level numeric
)
language plpgsql as $use$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_pieceowner uuid;
  v_name text; v_cost numeric; v_have numeric; v_reorder numeric;
  v_new numeric; v_id uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be greater than zero.'; end if;

  select owner_user_id into v_pieceowner from public.inventory_pieces where id = p_piece_id;
  if v_pieceowner is null or v_pieceowner <> v_uid then raise exception 'Not your piece.'; end if;

  select owner_user_id, name, avg_cost, quantity, reorder_level
    into v_owner, v_name, v_cost, v_have, v_reorder
    from public.books_inventory_items where id = p_item_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your supply item.'; end if;

  v_new := greatest(0, coalesce(v_have, 0) - p_qty);
  update public.books_inventory_items set quantity = v_new where id = p_item_id;

  insert into public.piece_supplies (owner_user_id, piece_id, item_id, item_name, unit_cost, qty)
  values (v_uid, p_piece_id, p_item_id, coalesce(v_name, ''), coalesce(v_cost, 0), p_qty)
  returning id into v_id;

  return query select
    v_id, coalesce(v_name, ''), coalesce(v_cost, 0), p_qty, v_new,
    (v_reorder is not null and v_new <= v_reorder), v_reorder;
end
$use$;

-- 3) Undo a usage: put the quantity back and remove the record.
create or replace function public.remove_piece_supply(p_id uuid)
returns void language plpgsql as $rem$
declare
  v_uid uuid := auth.uid(); v_owner uuid; v_item uuid; v_qty numeric;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select owner_user_id, item_id, qty into v_owner, v_item, v_qty
    from public.piece_supplies where id = p_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your record.'; end if;

  if v_item is not null then
    update public.books_inventory_items
      set quantity = quantity + coalesce(v_qty, 0)
      where id = v_item and owner_user_id = v_uid;
  end if;

  delete from public.piece_supplies where id = p_id;
end
$rem$;

-- ============================================================
-- End — use supplies on a piece
-- ============================================================
