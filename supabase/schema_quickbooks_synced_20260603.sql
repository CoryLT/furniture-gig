-- ============================================================
-- QuickBooks synced records — 2026-06-03
-- ============================================================
-- One row per FlipWork item already pushed to QuickBooks, so we
-- never post the same cost twice.
--   source_type = 'piece_acquisition' | 'piece_expense'
--   source_id   = the piece id (acquisition) or piece_expense id
--   qbo_id      = the QuickBooks transaction id we created
--
-- The unique (owner, source_type, source_id) is the guardrail.
-- Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.quickbooks_synced (
  id             uuid primary key default uuid_generate_v4(),
  owner_user_id  uuid references public.users(id) on delete cascade not null,
  source_type    text not null,
  source_id      text not null,
  qbo_type       text,
  qbo_id         text,
  amount         numeric(10,2),
  created_at     timestamptz not null default now(),
  unique (owner_user_id, source_type, source_id)
);

create index if not exists quickbooks_synced_owner_idx
  on public.quickbooks_synced (owner_user_id);

alter table public.quickbooks_synced enable row level security;

drop policy if exists "owner manages own quickbooks synced" on public.quickbooks_synced;
create policy "owner manages own quickbooks synced"
  on public.quickbooks_synced for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
