-- ============================================================
-- FlipWork — Marketplace (Facebook Marketplace / OfferUp style)
-- ============================================================
-- Adds:
--   1. marketplace_listings         — the items themselves
--   2. marketplace_photos           — photos per listing (1..N)
--   3. marketplace_blocked_keywords — words that auto-block a post
--   4. marketplace_categories       — the allowed category dropdown
--
-- Designed so the PUBLIC can browse active listings without
-- being logged in. Login is only required to POST a listing or
-- to MESSAGE a seller (messaging is a separate file).
--
-- This file is idempotent — safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. marketplace_categories
-- ------------------------------------------------------------
-- Curated list of categories sellers can pick from. Kept in a
-- table (not hardcoded) so admin can add/remove without a deploy.
-- Higher-risk categories (vehicles, pets, electronics, health)
-- are intentionally NOT seeded.
create table if not exists public.marketplace_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.marketplace_categories enable row level security;

-- Everyone (logged in or not) can see active categories
create policy "Anyone can view active categories"
  on public.marketplace_categories for select
  using (active = true);

-- Admin can manage categories
create policy "Admin can manage categories"
  on public.marketplace_categories for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Seed launch categories (idempotent via on conflict do nothing)
insert into public.marketplace_categories (slug, label, sort_order) values
  ('furniture',     'Furniture',         10),
  ('home-decor',    'Home Decor',        20),
  ('lighting',      'Lighting',          30),
  ('appliances',    'Appliances',        40),
  ('tools',         'Tools & Supplies',  50),
  ('outdoor',       'Outdoor & Garden',  60),
  ('other',         'Other',             99)
on conflict (slug) do nothing;


-- ------------------------------------------------------------
-- 2. marketplace_blocked_keywords
-- ------------------------------------------------------------
-- Words/phrases that auto-block a listing at post time. Stored
-- in a table so admin can add/remove without a deploy.
-- The matching is case-insensitive and substring-based on the
-- title + description, done in app code (not in SQL).
create table if not exists public.marketplace_blocked_keywords (
  id uuid primary key default uuid_generate_v4(),
  -- The phrase to match (lowercase). Stored as the canonical
  -- form; matching code lowercases the listing text first.
  phrase text not null unique,
  -- Bucket for analytics: 'weapon','drug','alcohol_tobacco',
  -- 'animal','adult','stolen_red_flag','counterfeit','hazmat',
  -- 'other'
  category text not null default 'other',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_blocked_keywords_active
  on public.marketplace_blocked_keywords(active);

alter table public.marketplace_blocked_keywords enable row level security;

-- Authenticated users can READ the active list (so the posting
-- form can pre-validate before submit). Admin can write.
create policy "Authenticated can read active blocked keywords"
  on public.marketplace_blocked_keywords for select
  using (auth.uid() is not null and active = true);

create policy "Admin can manage blocked keywords"
  on public.marketplace_blocked_keywords for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Seed initial blocked keywords (idempotent)
insert into public.marketplace_blocked_keywords (phrase, category) values
  -- Weapons
  ('firearm', 'weapon'), ('handgun', 'weapon'), ('pistol', 'weapon'),
  ('rifle', 'weapon'), ('shotgun', 'weapon'), ('revolver', 'weapon'),
  ('glock', 'weapon'), ('ar-15', 'weapon'), ('ar15', 'weapon'),
  ('ak-47', 'weapon'), ('ak47', 'weapon'),
  ('ammo', 'weapon'), ('ammunition', 'weapon'),
  ('suppressor', 'weapon'), ('silencer', 'weapon'),
  ('magazine clip', 'weapon'),
  ('switchblade', 'weapon'), ('brass knuckles', 'weapon'),
  ('taser', 'weapon'), ('stun gun', 'weapon'),
  ('crossbow', 'weapon'),
  -- Drugs
  ('marijuana', 'drug'), ('weed for sale', 'drug'),
  ('cocaine', 'drug'), ('meth', 'drug'), ('heroin', 'drug'),
  ('fentanyl', 'drug'), ('lsd', 'drug'), ('mdma', 'drug'),
  ('molly', 'drug'), ('ecstasy', 'drug'), ('shrooms', 'drug'),
  ('psilocybin', 'drug'),
  ('oxycontin', 'drug'), ('oxycodone', 'drug'), ('percocet', 'drug'),
  ('vicodin', 'drug'), ('hydrocodone', 'drug'),
  ('xanax', 'drug'), ('adderall', 'drug'), ('ritalin', 'drug'),
  ('valium', 'drug'), ('klonopin', 'drug'),
  ('vape cart', 'drug'), ('vape carts', 'drug'),
  ('edibles for sale', 'drug'),
  ('thc cartridge', 'drug'),
  ('kratom', 'drug'),
  ('drug paraphernalia', 'drug'),
  -- Alcohol / tobacco for resale
  ('case of beer', 'alcohol_tobacco'),
  ('case of liquor', 'alcohol_tobacco'),
  ('bottles of vodka', 'alcohol_tobacco'),
  ('cigarettes for sale', 'alcohol_tobacco'),
  ('cartons of cigarettes', 'alcohol_tobacco'),
  ('vape pods', 'alcohol_tobacco'),
  ('juul pods', 'alcohol_tobacco'),
  ('e-cigarette', 'alcohol_tobacco'),
  -- Live animals
  ('puppy for sale', 'animal'), ('puppies for sale', 'animal'),
  ('kitten for sale', 'animal'), ('kittens for sale', 'animal'),
  ('bird for sale', 'animal'),
  ('reptile for sale', 'animal'),
  ('snake for sale', 'animal'),
  ('rabbit for sale', 'animal'),
  ('hamster for sale', 'animal'),
  ('exotic animal', 'animal'),
  ('live animal', 'animal'),
  -- Adult
  ('escort', 'adult'), ('escorts', 'adult'),
  ('massage with happy', 'adult'),
  ('adult services', 'adult'),
  ('only fans content', 'adult'),
  ('nude photos', 'adult'),
  ('sex toy', 'adult'),
  -- Stolen-goods red flags
  ('no questions asked', 'stolen_red_flag'),
  ('off the back of a truck', 'stolen_red_flag'),
  ('fell off a truck', 'stolen_red_flag'),
  ('found in dumpster', 'stolen_red_flag'),
  ('hot item', 'stolen_red_flag'),
  -- Counterfeit
  ('replica rolex', 'counterfeit'), ('fake rolex', 'counterfeit'),
  ('replica gucci', 'counterfeit'), ('fake gucci', 'counterfeit'),
  ('replica louis vuitton', 'counterfeit'),
  ('aaa quality replica', 'counterfeit'),
  ('knockoff designer', 'counterfeit'),
  ('counterfeit money', 'counterfeit'),
  -- Hazmat
  ('fireworks', 'hazmat'),
  ('m-80', 'hazmat'),
  ('explosives', 'hazmat'),
  ('full propane tank', 'hazmat'),
  ('asbestos', 'hazmat')
on conflict (phrase) do nothing;


-- ------------------------------------------------------------
-- 3. marketplace_listings
-- ------------------------------------------------------------
-- The actual items for sale. Public can SELECT active ones.
-- Sellers can manage their own. Admin can do anything.
create table if not exists public.marketplace_listings (
  id uuid primary key default uuid_generate_v4(),
  seller_user_id uuid not null references public.users(id) on delete cascade,

  -- Content
  title text not null,
  slug text not null unique,
  description text not null default '',
  category_slug text not null
    references public.marketplace_categories(slug),

  -- Pricing — exactly ONE pricing mode:
  -- 'fixed'  → price_cents is the asking price (negotiable via chat)
  -- 'free'   → price_cents must be 0
  price_mode text not null default 'fixed'
    check (price_mode in ('fixed', 'free')),
  price_cents int not null default 0
    check (price_cents >= 0),

  -- Condition (optional, mirrors OfferUp/FB)
  condition text
    check (condition in ('new', 'like_new', 'good', 'fair', 'for_parts') or condition is null),

  -- Location: city/state required + optional rough lat/lng
  -- The lat/lng are stored fuzzed (~0.5 mile offset) at insert time
  -- by the app, so we never have the precise location in the DB.
  location_city text not null default '',
  location_state text not null default '',
  location_lat double precision,
  location_lng double precision,

  -- Lifecycle status
  -- 'active'   → publicly visible
  -- 'sold'     → kept visible but marked sold (greyed out)
  -- 'hidden'   → seller hid it (or admin), not publicly visible
  -- 'deleted'  → soft-deleted, never shown
  status text not null default 'active'
    check (status in ('active', 'sold', 'hidden', 'deleted')),

  -- Counts for the feed (cheap to denormalize)
  view_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz
);

-- Pricing rule: if mode is 'free' the price MUST be 0
alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_price_mode_amount_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_price_mode_amount_check
  check (
    (price_mode = 'free' and price_cents = 0)
    or (price_mode = 'fixed')
  );

create index if not exists idx_marketplace_listings_status_created
  on public.marketplace_listings(status, created_at desc);
create index if not exists idx_marketplace_listings_category
  on public.marketplace_listings(category_slug, status, created_at desc);
create index if not exists idx_marketplace_listings_seller
  on public.marketplace_listings(seller_user_id, created_at desc);
create index if not exists idx_marketplace_listings_state_city
  on public.marketplace_listings(location_state, location_city);

alter table public.marketplace_listings enable row level security;

-- PUBLIC (logged-in OR logged-out) can view active and sold listings
create policy "Public can view active and sold listings"
  on public.marketplace_listings for select
  using (status in ('active', 'sold'));

-- Seller can view their own listings in any status (including hidden)
create policy "Seller can view their own listings"
  on public.marketplace_listings for select
  using (auth.uid() = seller_user_id);

-- Seller can insert their own
create policy "Seller can insert their own listings"
  on public.marketplace_listings for insert
  with check (auth.uid() = seller_user_id);

-- Seller can update their own
create policy "Seller can update their own listings"
  on public.marketplace_listings for update
  using (auth.uid() = seller_user_id);

-- Seller can delete their own (soft-delete via update is preferred)
create policy "Seller can delete their own listings"
  on public.marketplace_listings for delete
  using (auth.uid() = seller_user_id);

-- Admin can manage all
create policy "Admin can manage all listings"
  on public.marketplace_listings for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Bump updated_at on every update (trigger)
create or replace function public.bump_marketplace_listing_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_marketplace_listings_updated_at
  on public.marketplace_listings;
create trigger trg_marketplace_listings_updated_at
  before update on public.marketplace_listings
  for each row execute function public.bump_marketplace_listing_updated_at();


-- ------------------------------------------------------------
-- 4. marketplace_photos
-- ------------------------------------------------------------
-- One row per photo. Up to 10 enforced in app code.
create table if not exists public.marketplace_photos (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null
    references public.marketplace_listings(id) on delete cascade,
  -- Path in the 'marketplace-photos' Supabase Storage bucket
  file_path text not null,
  caption text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_photos_listing
  on public.marketplace_photos(listing_id, sort_order);

alter table public.marketplace_photos enable row level security;

-- PUBLIC can view photos for any listing that's publicly visible
create policy "Public can view photos for visible listings"
  on public.marketplace_photos for select
  using (
    exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_photos.listing_id
        and l.status in ('active', 'sold')
    )
  );

-- Seller can view their own listing's photos in any status
create policy "Seller can view own photos"
  on public.marketplace_photos for select
  using (
    exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_photos.listing_id
        and l.seller_user_id = auth.uid()
    )
  );

-- Seller can insert photos on their own listings
create policy "Seller can insert own photos"
  on public.marketplace_photos for insert
  with check (
    exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_photos.listing_id
        and l.seller_user_id = auth.uid()
    )
  );

-- Seller can update / delete their own
create policy "Seller can update own photos"
  on public.marketplace_photos for update
  using (
    exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_photos.listing_id
        and l.seller_user_id = auth.uid()
    )
  );

create policy "Seller can delete own photos"
  on public.marketplace_photos for delete
  using (
    exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_photos.listing_id
        and l.seller_user_id = auth.uid()
    )
  );

-- Admin can manage all photos
create policy "Admin can manage all photos"
  on public.marketplace_photos for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ============================================================
-- DONE
-- ============================================================
-- Next file (run separately when ready):
--   schema_marketplace_messaging.sql — extends gig_conversations
--   to also handle (listing, buyer) conversations.
-- ============================================================
