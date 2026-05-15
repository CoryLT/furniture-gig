-- ============================================================
-- FlipWork v2 — Schema Additions
-- Run this in the Supabase SQL editor AFTER the original schema.sql
-- ============================================================

-- ============================================================
-- 1. UPDATE USERS ROLE — add 'flipper'
-- ============================================================
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in ('worker', 'admin', 'flipper'));

-- ============================================================
-- 2. ADD NEW COLUMNS TO WORKER PROFILES
-- ============================================================
alter table public.worker_profiles
  add column if not exists username text unique,
  add column if not exists bio text not null default '',
  add column if not exists skills text[] not null default '{}',
  add column if not exists avatar_url text not null default '',
  add column if not exists profile_public boolean not null default true;

-- Public can view worker profiles (for public profile pages)
create policy "Public can view public worker profiles"
  on public.worker_profiles for select
  using (profile_public = true);

-- ============================================================
-- 3. CREATE FLIPPER PROFILES TABLE
-- ============================================================
create table if not exists public.flipper_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null unique,
  username text unique,
  business_name text not null default '',
  bio text not null default '',
  city text not null default '',
  state text not null default '',
  website text not null default '',
  avatar_url text not null default '',
  profile_public boolean not null default true,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flipper_profiles enable row level security;

create policy "Flippers can view their own profile"
  on public.flipper_profiles for select
  using (auth.uid() = user_id);

create policy "Flippers can insert their own profile"
  on public.flipper_profiles for insert
  with check (auth.uid() = user_id);

create policy "Flippers can update their own profile"
  on public.flipper_profiles for update
  using (auth.uid() = user_id);

create policy "Public can view public flipper profiles"
  on public.flipper_profiles for select
  using (profile_public = true);

create policy "Admin can view all flipper profiles"
  on public.flipper_profiles for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- updated_at trigger for flipper_profiles
create trigger handle_updated_at before update on public.flipper_profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- 4. ADD CITY, STATE, POSTER_USER_ID TO GIGS
-- ============================================================
alter table public.gigs
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists poster_user_id uuid references public.users(id);

-- ============================================================
-- 5. UPDATE GIGS RLS — flippers can manage their own gigs
-- ============================================================
create policy "Flippers can insert their own gigs"
  on public.gigs for insert
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'flipper'
    )
    and poster_user_id = auth.uid()
  );

create policy "Flippers can update their own gigs"
  on public.gigs for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'flipper'
    )
    and poster_user_id = auth.uid()
  );

create policy "Flippers can view their own gigs"
  on public.gigs for select
  using (
    poster_user_id = auth.uid()
  );

-- ============================================================
-- 6. UPDATE HANDLE_NEW_USER TRIGGER
--    Now reads role from signup metadata and routes accordingly
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
begin
  -- Read role from signup metadata, default to 'worker'
  user_role := coalesce(new.raw_user_meta_data->>'role', 'worker');

  -- Override to admin if email matches
  if new.email = current_setting('app.admin_email', true) then
    user_role := 'admin';
  end if;

  insert into public.users (id, email, role)
  values (new.id, new.email, user_role);

  -- Create the right profile based on role
  if user_role = 'flipper' then
    insert into public.flipper_profiles (user_id)
    values (new.id);
  else
    -- worker and admin both get a worker_profile (admin harmless)
    insert into public.worker_profiles (user_id)
    values (new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 7. STORAGE — public profile photos bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Authenticated users can upload profile photos"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos'
    and auth.uid() is not null
  );

create policy "Users can delete their own profile photos"
  on storage.objects for delete
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
-- ============================================================
-- 8. GIG IMAGES TABLE
-- ============================================================
create table if not exists public.gig_images (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid references public.gigs(id) on delete cascade not null,
  file_path text not null,
  caption text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gig_images enable row level security;

-- Admin can view/insert/update/delete gig images
create policy "Admin can manage gig images"
  on public.gig_images for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Flippers can manage images on their own gigs
create policy "Flippers can manage images on their own gigs"
  on public.gig_images for all
  using (
    exists (
      select 1 from public.gigs g
      where g.id = gig_id and g.poster_user_id = auth.uid()
    )
  );

-- Anyone can view gig images (to see gigs)
create policy "Anyone can view gig images"
  on public.gig_images for select
  using (true);

-- updated_at trigger for gig_images
create trigger handle_updated_at before update on public.gig_images
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- 9. STORAGE — gig images bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('gig-images', 'gig-images', true)
on conflict (id) do nothing;

create policy "Anyone can view gig images in storage"
  on storage.objects for select
  using (bucket_id = 'gig-images');

create policy "Admin can upload gig images"
  on storage.objects for insert
  with check (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "Flippers can upload gig images"
  on storage.objects for insert
  with check (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'flipper'
    )
  );

create policy "Admin can delete gig images"
  on storage.objects for delete
  using (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "Flippers can delete their own gig images"
  on storage.objects for delete
  using (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.gigs g
      where g.poster_user_id = auth.uid()
    )
  );