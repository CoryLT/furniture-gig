-- ============================================================
-- FlipWork — Per-user conversation state (archive / delete)
-- ============================================================
-- Lets each user archive or delete a conversation from THEIR OWN
-- inbox without affecting the other participant. Works across all
-- three conversation kinds: gig, listing, and user-to-user.
--
-- We don't hard-delete anyone's messages. "Delete" here means
-- "hide from my inbox." A deleted thread reappears for a user when
-- a newer message arrives (compared against deleted_at).
--
-- This file is idempotent — safe to run more than once.
-- ============================================================

create table if not exists public.conversation_user_state (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_kind text not null
    check (conversation_kind in ('gig', 'listing', 'user')),
  conversation_id uuid not null,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, conversation_kind, conversation_id)
);

create index if not exists idx_conv_user_state_user
  on public.conversation_user_state(user_id);

create index if not exists idx_conv_user_state_lookup
  on public.conversation_user_state(user_id, conversation_kind, conversation_id);

alter table public.conversation_user_state enable row level security;

-- A user fully manages their own state rows (view/insert/update/delete)
drop policy if exists "Users manage their own conversation state"
  on public.conversation_user_state;
create policy "Users manage their own conversation state"
  on public.conversation_user_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
