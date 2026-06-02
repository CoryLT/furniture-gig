-- ============================================================
-- Operator Business Profile — 2026-06-01
-- ============================================================
-- Backs the "Business Setup" card on the dashboard. Each interactive
-- check-off writes the REAL detail into a column here instead of just
-- flipping a checkmark — so once captured, the info can be reused on the
-- records page, on contractor paperwork, on anything handed to a worker.
--
-- "Done" for an item = its value is filled in (for capture items) or its
-- boolean is true (for do-it items). One row per operator.
--
-- Note on sensitivity: we store useful, low-risk details (business name,
-- structure, state, EIN, which bank, which bookkeeping tool). We do NOT
-- store full bank account numbers or SSNs — no reason to hold those.
--
-- Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.operator_business (
  user_id                   uuid primary key references public.users(id) on delete cascade,
  business_name             text,
  structure                 text check (structure in ('sole_prop', 'llc', 's_corp', 'partnership', 'other')),
  state                     text,
  formation_date            date,
  ein                       text,          -- business tax ID; shown masked in the UI
  has_bank_account          boolean not null default false,
  bank_name                 text,
  bookkeeping_tool          text,
  collects_w9               boolean not null default false,
  uses_contractor_agreement boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.operator_business enable row level security;

-- You can read and write only your own business profile.
drop policy if exists "operator manages own business profile" on public.operator_business;
create policy "operator manages own business profile"
  on public.operator_business for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
