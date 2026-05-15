-- ============================================================
-- FlipWork — Full Database Schema
-- Run this in the Supabase SQL editor on a fresh project
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (extends auth.users)
-- ============================================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  role text not null default 'worker' check (role in ('worker', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own record"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own record"
  on public.users for update
  using (auth.uid() = id);

-- Admin can view all users
create policy "Admin can view all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- WORKER PROFILES
-- ============================================================
create table public.worker_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null unique,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  city text not null default '',
  state text not null default '',
  paypal_email text not null default '',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worker_profiles enable row level security;

create policy "Workers can view their own profile"
  on public.worker_profiles for select
  using (auth.uid() = user_id);

create policy "Workers can insert their own profile"
  on public.worker_profiles for insert
  with check (auth.uid() = user_id);

create policy "Workers can update their own profile"
  on public.worker_profiles for update
  using (auth.uid() = user_id);

create policy "Admin can view all worker profiles"
  on public.worker_profiles for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- ADMIN PROFILES
-- ============================================================
create table public.admin_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null unique,
  display_name text not null default 'Admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

create policy "Admin can manage their own profile"
  on public.admin_profiles for all
  using (auth.uid() = user_id);

-- ============================================================
-- LEGAL AGREEMENTS
-- ============================================================
create table public.legal_agreements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  version text not null default '1.0',
  content text not null,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_agreements enable row level security;

create policy "Anyone authenticated can view active agreements"
  on public.legal_agreements for select
  using (auth.uid() is not null and active = true);

create policy "Admin can manage agreements"
  on public.legal_agreements for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Seed the placeholder agreement
insert into public.legal_agreements (title, version, content, required, active)
values (
  'Independent Contractor Agreement',
  '1.0',
  'This is a placeholder agreement. The owner will replace this text before launch.

By accepting this agreement, you acknowledge that:

1. You are an independent contractor, not an employee.
2. You are responsible for your own taxes and insurance.
3. You agree to complete all assigned tasks according to the posted specifications.
4. You agree to submit accurate photo documentation of completed work.
5. Payment will be made via PayPal within the agreed timeframe after work approval.

[Full agreement text to be provided by the business owner before launch.]',
  true,
  true
);

-- ============================================================
-- USER AGREEMENT ACCEPTANCES
-- ============================================================
create table public.user_agreement_acceptances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  agreement_id uuid references public.legal_agreements(id) on delete cascade not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  unique(user_id, agreement_id)
);

alter table public.user_agreement_acceptances enable row level security;

create policy "Users can view their own acceptances"
  on public.user_agreement_acceptances for select
  using (auth.uid() = user_id);

create policy "Users can insert their own acceptances"
  on public.user_agreement_acceptances for insert
  with check (auth.uid() = user_id);

create policy "Admin can view all acceptances"
  on public.user_agreement_acceptances for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- GIGS
-- ============================================================
create table public.gigs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  summary text not null default '',
  description text not null default '',
  furniture_type text not null default '',
  location_text text not null default '',
  pay_amount numeric(10,2) not null default 0,
  required_skills text[] not null default '{}',
  due_date date,
  status text not null default 'draft' check (status in ('draft','open','claimed','in_review','completed','archived')),
  exclusive_claim boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gigs enable row level security;

create policy "Workers can view open/claimed/in_review gigs"
  on public.gigs for select
  using (
    auth.uid() is not null
    and status in ('open', 'claimed', 'in_review', 'completed')
  );

create policy "Admin can do everything with gigs"
  on public.gigs for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- GIG CHECKLIST ITEMS
-- ============================================================
create table public.gig_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid references public.gigs(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  sort_order int not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gig_checklist_items enable row level security;

create policy "Authenticated users can view checklist items"
  on public.gig_checklist_items for select
  using (auth.uid() is not null);

create policy "Admin can manage checklist items"
  on public.gig_checklist_items for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- GIG CLAIMS (exclusive — UNIQUE on gig_id)
-- ============================================================
create table public.gig_claims (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid references public.gigs(id) on delete cascade not null unique,
  worker_user_id uuid references public.users(id) on delete cascade not null,
  status text not null default 'active' check (status in ('active','submitted_for_review','approved','rejected','cancelled')),
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gig_claims enable row level security;

create policy "Workers can view their own claims"
  on public.gig_claims for select
  using (auth.uid() = worker_user_id);

create policy "Workers can insert their own claims"
  on public.gig_claims for insert
  with check (auth.uid() = worker_user_id);

create policy "Workers can update their own claims"
  on public.gig_claims for update
  using (auth.uid() = worker_user_id);

create policy "Admin can view and manage all claims"
  on public.gig_claims for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- GIG TASK COMPLETIONS
-- ============================================================
create table public.gig_task_completions (
  id uuid primary key default uuid_generate_v4(),
  checklist_item_id uuid references public.gig_checklist_items(id) on delete cascade not null,
  worker_user_id uuid references public.users(id) on delete cascade not null,
  completed boolean not null default false,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique(checklist_item_id, worker_user_id)
);

alter table public.gig_task_completions enable row level security;

create policy "Workers can manage their own task completions"
  on public.gig_task_completions for all
  using (auth.uid() = worker_user_id);

create policy "Admin can view all task completions"
  on public.gig_task_completions for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- GIG PHOTO UPLOADS
-- ============================================================
create table public.gig_photo_uploads (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid references public.gigs(id) on delete cascade not null,
  worker_user_id uuid references public.users(id) on delete cascade not null,
  file_path text not null,
  caption text not null default '',
  uploaded_at timestamptz not null default now()
);

alter table public.gig_photo_uploads enable row level security;

create policy "Workers can manage their own photo uploads"
  on public.gig_photo_uploads for all
  using (auth.uid() = worker_user_id);

create policy "Admin can view all photo uploads"
  on public.gig_photo_uploads for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- PAYOUT RECORDS
-- ============================================================
create table public.payout_records (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid references public.gigs(id) on delete cascade not null,
  worker_user_id uuid references public.users(id) on delete cascade not null,
  amount numeric(10,2) not null,
  payout_status text not null default 'unpaid' check (payout_status in ('unpaid','pending','paid')),
  payout_reference text not null default '',
  payout_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payout_records enable row level security;

create policy "Workers can view their own payout records"
  on public.payout_records for select
  using (auth.uid() = worker_user_id);

create policy "Admin can manage all payout records"
  on public.payout_records for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at before update on public.users
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.worker_profiles
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.admin_profiles
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.legal_agreements
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.gigs
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.gig_claims
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.gig_task_completions
  for each row execute procedure public.handle_updated_at();
create trigger handle_updated_at before update on public.payout_records
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- TRIGGER: auto-create user record + worker_profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email = current_setting('app.admin_email', true) then 'admin'
      else 'worker'
    end
  );

  -- Create worker profile for all users (admin can have one too, harmless)
  insert into public.worker_profiles (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE BUCKET for gig photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('gig-photos', 'gig-photos', false)
on conflict (id) do nothing;

create policy "Workers can upload their own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'gig-photos'
    and auth.uid() is not null
  );

create policy "Workers can view their own photos"
  on storage.objects for select
  using (
    bucket_id = 'gig-photos'
    and auth.uid() is not null
  );

create policy "Workers can delete their own photos"
  on storage.objects for delete
  using (
    bucket_id = 'gig-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
