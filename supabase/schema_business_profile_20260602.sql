-- ============================================================
-- Business Profile — operator's business setup details — 2026-06-02
-- ============================================================
-- Backs the "Business Setup" dashboard card. Each setup step the operator
-- finishes captures a real detail here (business name, structure, EIN, bank,
-- bookkeeping tool) instead of just ticking a box. Those details then drive
-- the card's live "business at a glance" view and get reused downstream
-- (payment records, contractor paperwork, anything handed to a worker).
--
-- One row per user, private to that user. We deliberately do NOT store
-- highly sensitive numbers — no bank account numbers, no SSNs — only the
-- low-risk business details the app actually needs.
--
-- Safe to re-run. Idempotent.
-- ============================================================

create table if not exists public.business_profiles (
  user_id                    uuid primary key references public.users(id) on delete cascade,
  business_name              text,
  structure                  text check (structure in ('sole_prop','llc','s_corp','undecided')),
  business_state             text,           -- 2-letter state, e.g. 'NC'
  formation_date             date,           -- when the entity was formed (LLC/corp)
  ein                        text,           -- business tax ID (NOT an SSN)
  bank_name                  text,           -- name only; never an account number
  bookkeeping_tool           text,
  contractor_paperwork_ready boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

alter table public.business_profiles enable row level security;

-- You can read and write only your own business profile.
drop policy if exists "user manages own business profile" on public.business_profiles;
create policy "user manages own business profile"
  on public.business_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
