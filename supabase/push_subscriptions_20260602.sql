-- ============================================================
-- FlipWork — Push notification subscriptions
-- Run this in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- One row per device/browser a user has turned notifications on for.
-- The server reads these (via the service role) to send a Web Push
-- when something happens (e.g. a new message).

create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  endpoint    text not null unique,   -- the browser/push-service URL
  p256dh      text not null,          -- public encryption key for this device
  auth        text not null,          -- auth secret for this device
  user_agent  text,                   -- which phone/browser (nice-to-have)
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- A signed-in user can only see / add / change / remove their OWN devices.
-- (The server uses the service role to read others' rows when sending.)
drop policy if exists "push_own_select" on public.push_subscriptions;
create policy "push_own_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_own_insert" on public.push_subscriptions;
create policy "push_own_insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_own_update" on public.push_subscriptions;
create policy "push_own_update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_own_delete" on public.push_subscriptions;
create policy "push_own_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
