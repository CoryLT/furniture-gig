-- ============================================================
-- FlipWork — Notifications system (in-app, generic)
-- ============================================================
-- Generic per-user notification feed. First event type wired up
-- is `follow` (someone followed you). The shape is designed so we
-- can add new event types later by just inserting more rows with
-- a different `type` value.
--
-- Idempotent. Safe to re-run.
-- ============================================================

-- ============================================================
-- TABLE
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  -- Who is this notification for?
  recipient_user_id uuid references public.users(id) on delete cascade not null,
  -- Who/what caused it? (null for system-generated)
  actor_user_id uuid references public.users(id) on delete cascade,
  -- Short event key — extend this set over time
  type text not null check (type in ('follow')),
  -- Flexible payload (avatar/link details if we want to denormalize later)
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Fast lookup: a user's unread + recent feed
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id)
  where read_at is null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.notifications enable row level security;

drop policy if exists "Users can see their own notifications" on public.notifications;
drop policy if exists "Users can mark their own notifications read" on public.notifications;
drop policy if exists "Users can delete their own notifications" on public.notifications;

-- Read only your own
create policy "Users can see their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_user_id);

-- Update only your own (used for marking read)
create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- Delete only your own (optional, but nice for cleanup later)
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = recipient_user_id);

-- NOTE: we deliberately do NOT add an INSERT policy. Notifications
-- are created server-side by triggers (SECURITY DEFINER) only.
-- This stops clients from forging notifications for other users.

-- ============================================================
-- TRIGGER: on every new follow row, create a notification for
-- the followed user. SECURITY DEFINER so the insert bypasses RLS.
-- ============================================================
create or replace function public.create_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Defensive: a self-follow shouldn't be possible (CHECK constraint),
  -- but skip it anyway if somehow it slips through.
  if NEW.follower_user_id = NEW.followed_user_id then
    return NEW;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    data
  ) values (
    NEW.followed_user_id,
    NEW.follower_user_id,
    'follow',
    jsonb_build_object('follow_id', NEW.id)
  );

  return NEW;
end;
$$;

-- Drop + recreate so this stays idempotent
drop trigger if exists follows_create_notification on public.follows;
create trigger follows_create_notification
  after insert on public.follows
  for each row
  execute function public.create_follow_notification();

-- ============================================================
-- Report
-- ============================================================
select
  (select count(*) from public.notifications) as total_notifications,
  (select count(*) from public.notifications where read_at is null) as total_unread;
