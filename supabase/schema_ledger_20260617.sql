-- ============================================================
-- FLIPWORK-LEDGER-V1  —  double-entry bookkeeping foundation  —  2026-06-17
-- ============================================================
-- This is step 2 of bringing FlipWork Books into the marketplace app.
-- It adds the EMPTY bookkeeping tables. It does NOT touch your live app,
-- your gigs, your listings, or any existing data. Nothing happens until
-- you run it, and after you run it the app behaves exactly the same until
-- we wire screens up to these tables in later steps.
--
-- What it creates:
--   accounts      - your "money buckets" (Cash on Hand, Furniture Sales,
--                   Materials, etc.). Every bucket has a type.
--   contacts      - the people you pay (workers AND vendors), just names.
--   transactions  - the "header" for each money event (a sale, an expense),
--                   optionally tagged to a piece and/or a contact.
--   entry_lines   - the two balanced halves of each transaction (a debit
--                   and a credit) that make the books actually balance.
--
-- Privacy fence: every table is stamped with an owner and locked so a
-- logged-in operator can only ever see and change their OWN books.
--
-- Balance rule: a transaction's debits must equal its credits, or it's
-- rejected. The check waits until the whole save is done, so saving the
-- two halves together is fine.
--
-- Pieces: we hook onto the marketplace's existing inventory_pieces — we do
-- NOT make a second piece list. Safe to re-run. Idempotent.
-- ============================================================

-- ---------- 1. accounts (the money buckets) ----------
create table if not exists public.accounts (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  name          text not null,
  type          text not null check (type in ('asset','liability','equity','income','expense')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists accounts_owner_idx on public.accounts (owner_user_id);

alter table public.accounts enable row level security;
drop policy if exists "owner manages own accounts" on public.accounts;
create policy "owner manages own accounts"
  on public.accounts for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());


-- ---------- 2. contacts (people you pay: workers + vendors) ----------
create table if not exists public.contacts (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  name          text not null,
  type          text not null default 'other' check (type in ('worker','vendor','other')),
  phone         text,
  email         text,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists contacts_owner_idx on public.contacts (owner_user_id);

alter table public.contacts enable row level security;
drop policy if exists "owner manages own contacts" on public.contacts;
create policy "owner manages own contacts"
  on public.contacts for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());


-- ---------- 3. transactions (the header for each money event) ----------
create table if not exists public.transactions (
  id            uuid primary key default uuid_generate_v4(),
  owner_user_id uuid references public.users(id) on delete cascade not null,
  date          date not null default current_date,
  description   text not null default '',
  memo          text,
  piece_id      uuid references public.inventory_pieces(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete set null,
  receipt_path  text,
  created_at    timestamptz not null default now()
);

create index if not exists transactions_owner_idx   on public.transactions (owner_user_id);
create index if not exists transactions_piece_idx   on public.transactions (piece_id);
create index if not exists transactions_contact_idx on public.transactions (contact_id);

alter table public.transactions enable row level security;
drop policy if exists "owner manages own transactions" on public.transactions;
create policy "owner manages own transactions"
  on public.transactions for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());


-- ---------- 4. entry_lines (the two balanced halves) ----------
create table if not exists public.entry_lines (
  id             uuid primary key default uuid_generate_v4(),
  owner_user_id  uuid references public.users(id) on delete cascade not null,
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  account_id     uuid references public.accounts(id) on delete restrict not null,
  debit          numeric(12,2) not null default 0 check (debit  >= 0),
  credit         numeric(12,2) not null default 0 check (credit >= 0),
  created_at     timestamptz not null default now(),
  -- a line is one side or the other, never both at once
  check (debit = 0 or credit = 0)
);

create index if not exists entry_lines_txn_idx     on public.entry_lines (transaction_id);
create index if not exists entry_lines_account_idx on public.entry_lines (account_id);
create index if not exists entry_lines_owner_idx   on public.entry_lines (owner_user_id);

alter table public.entry_lines enable row level security;
drop policy if exists "owner manages own entry lines" on public.entry_lines;
create policy "owner manages own entry lines"
  on public.entry_lines for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());


-- ---------- 5. balance rule: debits must equal credits ----------
-- Runs after each change to entry_lines, but waits until the whole save
-- finishes (deferred), so inserting both halves in one go is allowed.
create or replace function public.assert_transaction_balanced()
returns trigger
language plpgsql
as $$
declare
  v_txn  uuid;
  v_diff numeric;
begin
  v_txn := coalesce(new.transaction_id, old.transaction_id);

  select coalesce(sum(debit), 0) - coalesce(sum(credit), 0)
    into v_diff
    from public.entry_lines
   where transaction_id = v_txn;

  if v_diff <> 0 then
    raise exception
      'Books out of balance: transaction % has debits-minus-credits of %', v_txn, v_diff;
  end if;

  return null;
end;
$$;

drop trigger if exists entry_lines_balanced on public.entry_lines;
create constraint trigger entry_lines_balanced
  after insert or update or delete on public.entry_lines
  deferrable initially deferred
  for each row execute function public.assert_transaction_balanced();

-- ============================================================
-- End FLIPWORK-LEDGER-V1
-- ============================================================
