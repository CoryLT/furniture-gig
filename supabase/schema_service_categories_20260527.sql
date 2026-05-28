-- ============================================================
-- FlipWork — Service Categories
-- ============================================================
-- A table of broad service categories that workers can pick from
-- when listing services they offer on their public profile.
--
-- Kept separate from marketplace_categories because:
--   * Services and items are different concepts.
--   * Admin may want to manage them independently.
--   * RLS and seed lists differ.
--
-- This file is idempotent — safe to run more than once.
-- ============================================================

create table if not exists public.service_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_categories enable row level security;

-- Anyone (even logged-out) can read active categories (needed for
-- public profile pages and the future browse-by-category page).
drop policy if exists "Public can view active service categories"
  on public.service_categories;
create policy "Public can view active service categories"
  on public.service_categories for select
  using (active = true);

-- Admin can manage categories
drop policy if exists "Admin can manage service categories"
  on public.service_categories;
create policy "Admin can manage service categories"
  on public.service_categories for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- Seed data — ~90 broad categories, alphabetized within groups.
-- Delivery is explicitly included.
-- Higher-risk categories (firearms, prescription meds, etc.)
-- are intentionally omitted.
-- ------------------------------------------------------------
insert into public.service_categories (slug, label, sort_order) values
  -- Transportation & logistics
  ('delivery',                  'Delivery',                       10),
  ('moving-help',               'Moving Help',                    20),
  ('hauling-junk-removal',      'Hauling / Junk Removal',         30),
  ('courier-services',          'Courier Services',               40),
  ('vehicle-transport',         'Vehicle Transport',              50),

  -- Furniture-specific
  ('furniture-flipping',        'Furniture Flipping',            100),
  ('furniture-repair',          'Furniture Repair',              110),
  ('furniture-refinishing',     'Furniture Refinishing',         120),
  ('reupholstery',              'Reupholstery',                  130),
  ('furniture-assembly',        'Furniture Assembly',            140),
  ('antique-restoration',       'Antique Restoration',           150),
  ('custom-furniture-building', 'Custom Furniture Building',     160),

  -- Painting & finishes
  ('painting-interior',         'Interior Painting',             200),
  ('painting-exterior',         'Exterior Painting',             210),
  ('chalk-paint-specialist',    'Chalk Paint Specialist',        220),
  ('wood-staining',             'Wood Staining',                 230),
  ('decorative-finishes',       'Decorative Finishes',           240),
  ('cabinet-refinishing',       'Cabinet Refinishing',           250),

  -- Wood & metal
  ('woodworking',               'Woodworking',                   300),
  ('carpentry',                 'Carpentry',                     310),
  ('cabinet-making',            'Cabinet Making',                320),
  ('metalworking',              'Metalworking',                  330),
  ('welding',                   'Welding',                       340),
  ('blacksmithing',             'Blacksmithing',                 350),

  -- Cars & vehicles
  ('car-flipping',              'Car Flipping',                  400),
  ('auto-detailing',            'Auto Detailing',                410),
  ('auto-body-repair',          'Auto Body Repair',              420),
  ('mechanical-repair',         'Mechanical Repair',             430),
  ('motorcycle-repair',         'Motorcycle Repair',             440),
  ('boat-detailing',            'Boat Detailing',                450),
  ('rv-services',               'RV Services',                   460),

  -- Electronics & tech (low risk only)
  ('phone-repair',              'Phone Repair',                  500),
  ('computer-repair',           'Computer Repair',               510),
  ('appliance-repair',          'Appliance Repair',              520),
  ('tv-mounting',               'TV Mounting',                   530),
  ('smart-home-setup',          'Smart Home Setup',              540),

  -- Clothing & textiles
  ('clothing-flipping',         'Clothing Flipping',             600),
  ('alterations-tailoring',     'Alterations / Tailoring',       610),
  ('sewing',                    'Sewing',                        620),
  ('embroidery',                'Embroidery',                    630),
  ('screen-printing',           'Screen Printing',               640),
  ('shoe-repair',               'Shoe Repair',                   650),
  ('leather-work',              'Leather Work',                  660),

  -- Home services
  ('handyman',                  'Handyman',                      700),
  ('drywall-repair',            'Drywall Repair',                710),
  ('flooring-install',          'Flooring Installation',         720),
  ('tile-work',                 'Tile Work',                     730),
  ('plumbing-minor',            'Plumbing (Minor Repairs)',      740),
  ('electrical-minor',          'Electrical (Minor Repairs)',    750),
  ('pressure-washing',          'Pressure Washing',              760),
  ('gutter-cleaning',           'Gutter Cleaning',               770),
  ('window-cleaning',           'Window Cleaning',               780),
  ('house-cleaning',            'House Cleaning',                790),
  ('deep-cleaning',             'Deep Cleaning',                 800),
  ('organizing',                'Home Organizing',               810),

  -- Yard & outdoor
  ('lawn-care',                 'Lawn Care',                     900),
  ('landscaping',               'Landscaping',                   910),
  ('tree-trimming',             'Tree Trimming',                 920),
  ('snow-removal',              'Snow Removal',                  930),
  ('fence-install-repair',      'Fence Install / Repair',        940),
  ('deck-build-repair',         'Deck Build / Repair',           950),

  -- Creative & craft
  ('photography',               'Photography',                  1000),
  ('videography',               'Videography',                  1010),
  ('graphic-design',            'Graphic Design',               1020),
  ('product-photography',       'Product Photography',          1030),
  ('logo-branding',             'Logo & Branding',              1040),
  ('signage-vinyl',             'Signage & Vinyl',              1050),
  ('jewelry-making',            'Jewelry Making',               1060),
  ('pottery-ceramics',          'Pottery / Ceramics',           1070),
  ('candle-soap-making',        'Candle / Soap Making',         1080),

  -- Online & admin
  ('virtual-assistant',         'Virtual Assistant',            1100),
  ('data-entry',                'Data Entry',                   1110),
  ('bookkeeping',               'Bookkeeping',                  1120),
  ('listing-writing',           'Listing Writing',              1130),
  ('social-media-management',   'Social Media Management',      1140),
  ('website-building',          'Website Building',             1150),
  ('seo-services',              'SEO Services',                 1160),
  ('transcription',             'Transcription',                1170),

  -- Resale & flipping support
  ('estate-sale-help',          'Estate Sale Help',             1200),
  ('garage-sale-help',          'Garage Sale Help',             1210),
  ('thrift-sourcing',           'Thrift Sourcing',              1220),
  ('auction-bidding',           'Auction Bidding',              1230),
  ('product-research',          'Product Research',             1240),
  ('pricing-consulting',        'Pricing Consulting',           1250),

  -- Misc skilled
  ('locksmithing',              'Locksmithing',                 1300),
  ('knife-tool-sharpening',     'Knife / Tool Sharpening',      1310),
  ('musical-instrument-repair', 'Musical Instrument Repair',    1320),
  ('bicycle-repair',            'Bicycle Repair',               1330),
  ('small-engine-repair',       'Small Engine Repair',          1340),

  -- Catch-all
  ('other-services',            'Other Services',               9999)
on conflict (slug) do nothing;
