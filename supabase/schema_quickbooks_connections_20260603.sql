-- ============================================================
-- QuickBooks connection per user — 2026-06-03
-- ============================================================
-- Stores the OAuth link between a FlipWork user and their
-- QuickBooks Online company. One row per user.
--
-- realm_id        = the QuickBooks company id
-- access_token    = short-lived key (about 1 hour) used for API calls
-- refresh_token   = longer-lived key used to get fresh access tokens
-- *_expires_at    = when each token stops working
--
-- Only server code (service role) ever reads the tokens. RLS lets a
-- user see/manage only their own row. Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.quickbooks_connections (
  id                  uuid primary key default uuid_generate_v4(),
  owner_user_id       uuid references public.users(id) on delete cascade not null unique,
  realm_id            text not null,
  access_token        text not null,
  refresh_token       text not null,
  access_expires_at   timestamptz,
  refresh_expires_at  timestamptz,
  environment         text not null default 'sandbox'
                        check (environment in ('sandbox','production')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.quickbooks_connections enable row level security;

drop policy if exists "owner manages own quickbooks connection" on public.quickbooks_connections;
create policy "owner manages own quickbooks connection"
  on public.quickbooks_connections for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
