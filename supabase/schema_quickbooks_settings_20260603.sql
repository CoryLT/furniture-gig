-- ============================================================
-- QuickBooks sync settings per user — 2026-06-03
-- ============================================================
-- Remembers how a user's FlipWork costs map into QuickBooks:
--   paid_from_account_id = default account money comes out of
--   category_map         = { "materials": "<acctId>", "labor": "<acctId>", ... }
--                          one QuickBooks expense account per FlipWork category
--
-- One row per user. Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.quickbooks_settings (
  owner_user_id        uuid references public.users(id) on delete cascade not null primary key,
  paid_from_account_id text,
  category_map         jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.quickbooks_settings enable row level security;

drop policy if exists "owner manages own quickbooks settings" on public.quickbooks_settings;
create policy "owner manages own quickbooks settings"
  on public.quickbooks_settings for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
