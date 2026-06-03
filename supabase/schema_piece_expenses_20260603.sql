-- ============================================================
-- Piece Expenses — itemized cost log per flip — 2026-06-03
-- ============================================================
-- Each row is one expense against a piece, logged as it happens
-- (paint, hardware, gas, a payment to a worker, listing fees...).
--
-- Total invested in a piece = inventory_pieces.acquisition_cost
--                             + SUM(piece_expenses.amount)
-- Profit = sale_price - total invested.
--
-- Replaces the old single materials_cost / labor_cost fields with a
-- real running ledger (which also becomes deductible-expense records
-- for tax time). Deleting a piece removes its expenses (cascade).
--
-- One owner per row, private to that owner. Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.piece_expenses (
  id             uuid primary key default uuid_generate_v4(),
  piece_id       uuid references public.inventory_pieces(id) on delete cascade not null,
  owner_user_id  uuid references public.users(id) on delete cascade not null,
  amount         numeric(10,2) not null default 0,
  category       text check (category in ('materials','labor','transport','fees','other')),
  note           text not null default '',
  spent_on       date not null default current_date,
  created_at     timestamptz not null default now()
);

create index if not exists piece_expenses_piece_idx on public.piece_expenses (piece_id);

alter table public.piece_expenses enable row level security;

-- You can read and write only your own expense lines.
drop policy if exists "owner manages own expenses" on public.piece_expenses;
create policy "owner manages own expenses"
  on public.piece_expenses for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
