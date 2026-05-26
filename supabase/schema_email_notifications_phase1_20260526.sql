-- ============================================================
-- Email notifications — Phase 1 foundation — 2026-05-26
-- ============================================================
-- Adds two tables:
--
--   1. notification_preferences — one row per user, with per-event
--      toggles for email sending. New users get a default row via
--      trigger on auth.users insert. Existing users get backfilled
--      below.
--
--   2. email_log — every Resend send (success OR failure) gets a
--      row here. Used for debugging, deduplication, and the
--      per-event idempotency keys.
--
-- All sends happen server-side. Clients can read their own
-- preferences and update them; they cannot read or write email_log
-- at all (admin only / service-role only).
--
-- Idempotent. Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1) notification_preferences
-- ------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  -- Email toggles. Defaults are all ON because the user opted in
  -- by signing up + agreeing to ToS, and these are transactional
  -- (not marketing) emails.
  email_picked    boolean not null default true,
  email_rejected  boolean not null default true,
  email_messages  boolean not null default true,
  -- Future-proof: add SMS toggles here when we layer that in later.
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- A user can SELECT only their own preferences row
drop policy if exists "Users read own notification_preferences" on public.notification_preferences;
create policy "Users read own notification_preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

-- A user can UPDATE only their own preferences row
drop policy if exists "Users update own notification_preferences" on public.notification_preferences;
create policy "Users update own notification_preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INSERT is deliberately NOT given to clients. Rows are created by
-- the trigger below (SECURITY DEFINER), not by client code.

-- Keep updated_at fresh on every UPDATE
create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.touch_notification_preferences_updated_at();


-- ------------------------------------------------------------
-- 2) Auto-create a preferences row whenever a new user signs up
-- ------------------------------------------------------------
create or replace function public.create_default_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotent: do nothing if a row somehow already exists for this user.
  insert into public.notification_preferences (user_id)
  values (NEW.id)
  on conflict (user_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_create_default_notification_preferences on public.users;
create trigger trg_create_default_notification_preferences
  after insert on public.users
  for each row
  execute function public.create_default_notification_preferences();


-- ------------------------------------------------------------
-- 3) Backfill existing users
-- ------------------------------------------------------------
insert into public.notification_preferences (user_id)
select u.id
from public.users u
left join public.notification_preferences np on np.user_id = u.id
where np.user_id is null;


-- ------------------------------------------------------------
-- 4) email_log
-- ------------------------------------------------------------
-- Records every email send attempt for debugging + dedup. The
-- idempotency_key is what stops us from sending the same email
-- twice (e.g. if a trigger fires twice or a retry storms in).
-- Format: '<event_type>:<entity_id>:<recipient_user_id>'
--   e.g. 'gig_picked:<gig_id>:<worker_user_id>'
create table if not exists public.email_log (
  id uuid primary key default uuid_generate_v4(),
  recipient_user_id uuid references public.users(id) on delete set null,
  recipient_email   text not null,
  event_type text not null check (event_type in (
    'gig_picked',
    'gig_rejected',
    'new_message',
    'test'
  )),
  -- Whatever entity this email is about (gig_id, message_id, etc.).
  -- Free-form so we can wire new event types without schema changes.
  related_entity_id uuid,
  -- Resend's message ID (when send succeeded)
  resend_message_id text,
  -- 'sent', 'failed', 'skipped_preferences', 'skipped_duplicate'
  status text not null check (status in (
    'sent', 'failed', 'skipped_preferences', 'skipped_duplicate'
  )),
  error_message text,
  -- The dedup key. NULL allowed because some sends (e.g. test) don't
  -- need dedup; UNIQUE means duplicate keys are rejected, which is
  -- exactly the protection we want.
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists email_log_idempotency_key_idx
  on public.email_log (idempotency_key)
  where idempotency_key is not null;

create index if not exists email_log_recipient_created_idx
  on public.email_log (recipient_user_id, created_at desc);

alter table public.email_log enable row level security;

-- NO client-side policies on email_log. Service-role writes only.
-- That means admin sees nothing through the regular Supabase client
-- either; if you want admin visibility later, add a SELECT policy
-- restricted to role='admin'.


-- ------------------------------------------------------------
-- 5) Report
-- ------------------------------------------------------------
select
  (select count(*) from public.users) as total_users,
  (select count(*) from public.notification_preferences) as total_preferences_rows,
  (select count(*) from public.email_log) as total_emails_logged;
