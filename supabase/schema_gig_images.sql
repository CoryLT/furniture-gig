-- ============================================================
-- GIG IMAGES TABLE (for admin reference/cover photos)
-- Run this SQL in Supabase if you want to add admin image uploads
-- ============================================================

-- Create gig_images table
create table public.gig_images (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid references public.gigs(id) on delete cascade not null,
  file_path text not null,
  caption text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gig_images enable row level security;

-- Admin can manage gig images
create policy "Admin can manage gig images"
  on public.gig_images for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Workers can view gig images for open gigs
create policy "Workers can view gig images for open gigs"
  on public.gig_images for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.gigs g
      where g.id = gig_id and g.status in ('open', 'claimed', 'in_review', 'completed')
    )
  );

-- Create index for faster lookups
create index idx_gig_images_gig_id on public.gig_images(gig_id);
create index idx_gig_images_sort_order on public.gig_images(gig_id, sort_order);

-- ============================================================
-- STORAGE BUCKET for gig reference images (admin uploads)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('gig-images', 'gig-images', false)
on conflict (id) do nothing;

-- Admin can upload gig images
create policy "Admin can upload gig images"
  on storage.objects for insert
  with check (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Admin can manage (update/delete) their own gig images
create policy "Admin can manage gig images in storage"
  on storage.objects for update
  using (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "Admin can delete gig images in storage"
  on storage.objects for delete
  using (
    bucket_id = 'gig-images'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Workers can view public gig images
create policy "Workers can view gig images in storage"
  on storage.objects for select
  using (
    bucket_id = 'gig-images'
    and auth.uid() is not null
  );

