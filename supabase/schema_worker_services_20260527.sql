-- ============================================================
-- FlipWork — Worker Services
-- ============================================================
-- Lets a worker advertise up to 10 services on their public
-- profile. Each service references a service_categories row,
-- has a short blurb, and a pricing block.
--
-- Location is inherited from the worker's profile (city/state),
-- so no per-service location column.
--
-- This file is idempotent — safe to run more than once.
-- ============================================================

create table if not exists public.worker_services (
  id uuid primary key default uuid_generate_v4(),
  worker_user_id uuid not null
    references public.users(id) on delete cascade,
  category_id uuid not null
    references public.service_categories(id) on delete restrict,
  blurb text not null default '' check (length(blurb) <= 300),
  price_type text not null default 'contact_for_quote'
    check (price_type in ('flat', 'hourly', 'starting_at', 'contact_for_quote')),
  price_amount numeric(10,2),  -- nullable: not used when price_type = 'contact_for_quote'
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_worker_services_worker
  on public.worker_services(worker_user_id);

create index if not exists idx_worker_services_category
  on public.worker_services(category_id)
  where active = true;

-- A worker shouldn't be able to list the same category twice
create unique index if not exists idx_worker_services_unique_category_per_worker
  on public.worker_services(worker_user_id, category_id);


-- ------------------------------------------------------------
-- Enforce max 10 services per worker
-- ------------------------------------------------------------
create or replace function public.enforce_max_worker_services()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.worker_services
    where worker_user_id = new.worker_user_id
  ) >= 10 then
    raise exception 'A worker can list a maximum of 10 services';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_max_worker_services on public.worker_services;
create trigger trg_enforce_max_worker_services
  before insert on public.worker_services
  for each row execute function public.enforce_max_worker_services();


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.worker_services enable row level security;

-- Public can read services tied to public worker profiles
drop policy if exists "Public can view services on public profiles"
  on public.worker_services;
create policy "Public can view services on public profiles"
  on public.worker_services for select
  using (
    active = true
    and exists (
      select 1 from public.worker_profiles wp
      where wp.user_id = worker_services.worker_user_id
        and wp.profile_public = true
    )
  );

-- Workers can view all their own services (active or not)
drop policy if exists "Workers can view their own services"
  on public.worker_services;
create policy "Workers can view their own services"
  on public.worker_services for select
  using (auth.uid() = worker_user_id);

-- Workers can insert their own services
drop policy if exists "Workers can insert their own services"
  on public.worker_services;
create policy "Workers can insert their own services"
  on public.worker_services for insert
  with check (auth.uid() = worker_user_id);

-- Workers can update their own services
drop policy if exists "Workers can update their own services"
  on public.worker_services;
create policy "Workers can update their own services"
  on public.worker_services for update
  using (auth.uid() = worker_user_id);

-- Workers can delete their own services
drop policy if exists "Workers can delete their own services"
  on public.worker_services;
create policy "Workers can delete their own services"
  on public.worker_services for delete
  using (auth.uid() = worker_user_id);

-- Admin can view all
drop policy if exists "Admin can view all worker services"
  on public.worker_services;
create policy "Admin can view all worker services"
  on public.worker_services for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
