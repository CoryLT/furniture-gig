-- ============================================================
-- FlipWork — Image moderation + user reports
-- ============================================================
-- Adds:
--   1. A moderation_log table — every upload check is logged here
--      with the model scores from Sightengine. Useful for tuning
--      thresholds and reviewing borderline cases.
--
--   2. An image_reports table — users can flag any image they
--      see. Admin reviews and resolves.
--
-- This file is idempotent — safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. moderation_log
-- ------------------------------------------------------------
-- Records every Sightengine check, whether the image was allowed
-- or blocked, and the raw scores. Logs blocked uploads too so we
-- can see what got rejected.
create table if not exists public.moderation_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  -- Where the image came from: 'avatar', 'flipper_gallery',
  -- 'worker_gallery', 'gig_photo', 'gig_image'
  upload_source text not null,
  -- The file path in storage IF it was allowed (null if blocked)
  file_path text,
  passed boolean not null,
  -- The reason it was blocked: 'nudity', 'weapon', 'drugs',
  -- 'gore', 'offensive', or null if it passed
  block_reason text,
  -- Raw JSON scores from Sightengine for debugging / tuning
  raw_scores jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_log_user
  on public.moderation_log(user_id);
create index if not exists idx_moderation_log_created
  on public.moderation_log(created_at desc);
create index if not exists idx_moderation_log_passed
  on public.moderation_log(passed, created_at desc);

alter table public.moderation_log enable row level security;

-- Only admin can read the moderation log
create policy "Admin can view moderation log"
  on public.moderation_log for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Anyone authenticated can INSERT (the upload API does this on
-- behalf of the user). Service-role keys bypass RLS anyway.
create policy "Authenticated can insert moderation log"
  on public.moderation_log for insert
  with check (auth.uid() is not null);


-- ------------------------------------------------------------
-- 2. image_reports
-- ------------------------------------------------------------
-- A user flagging an image they think violates the rules.
-- 'image_kind' tells admin which table+path to look at.
create table if not exists public.image_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_user_id uuid references public.users(id) on delete set null,
  -- Which image is being reported. One of:
  -- 'avatar', 'flipper_gallery', 'worker_gallery',
  -- 'gig_photo', 'gig_image'
  image_kind text not null,
  -- The file path in Supabase Storage (so admin can view it)
  file_path text not null,
  -- The bucket name in Supabase Storage
  bucket text not null,
  -- Optional context — the row id in the source table, if any
  source_row_id uuid,
  -- The user who owns/uploaded the image (so admin can take action)
  owner_user_id uuid references public.users(id) on delete set null,
  -- Reporter's reason (free text)
  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'resolved_removed', 'resolved_kept', 'dismissed')),
  -- Admin notes on the resolution
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

create index if not exists idx_image_reports_status
  on public.image_reports(status, created_at desc);
create index if not exists idx_image_reports_reporter
  on public.image_reports(reporter_user_id);
create index if not exists idx_image_reports_owner
  on public.image_reports(owner_user_id);

alter table public.image_reports enable row level security;

-- Any authenticated user can file a report
create policy "Authenticated can insert reports"
  on public.image_reports for insert
  with check (auth.uid() = reporter_user_id);

-- A reporter can view their own reports (so they can see status)
create policy "Reporters can view their own reports"
  on public.image_reports for select
  using (auth.uid() = reporter_user_id);

-- Admin can view and update all reports
create policy "Admin can view all reports"
  on public.image_reports for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "Admin can update reports"
  on public.image_reports for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
