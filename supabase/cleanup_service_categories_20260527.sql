-- ============================================================
-- FlipWork — Trim service_categories to the flipping economy
-- ============================================================
-- Removes generic local-services categories and anything that can
-- be done as a "human-in-the-loop AI" laptop task. Keeps only
-- categories that require hands-on physical human labor tied to
-- the buy / fix / resell ecosystem.
--
-- Safe: deletes ONLY categories with no worker_services attached.
-- (service_categories is referenced by worker_services with
--  on delete restrict, so a category in use cannot be deleted.)
--
-- This file is idempotent — safe to run more than once.
-- ============================================================

delete from public.service_categories
where slug in (
  -- Home services (generic, homeowner-facing)
  'handyman',
  'drywall-repair',
  'flooring-install',
  'tile-work',
  'plumbing-minor',
  'electrical-minor',
  'pressure-washing',
  'gutter-cleaning',
  'window-cleaning',
  'house-cleaning',
  'deep-cleaning',
  'organizing',
  -- Yard & outdoor (generic, homeowner-facing)
  'lawn-care',
  'landscaping',
  'tree-trimming',
  'snow-removal',
  'fence-install-repair',
  'deck-build-repair',
  -- Online / admin (laptop + AI work)
  'virtual-assistant',
  'data-entry',
  'bookkeeping',
  'social-media-management',
  'website-building',
  'seo-services',
  'transcription',
  -- Creative / resale that AI can do at a laptop
  'graphic-design',
  'logo-branding',
  'listing-writing',
  'product-research',
  'pricing-consulting',
  -- Can be automated
  'auction-bidding'
)
-- Only delete if nothing is using the category
and id not in (
  select distinct category_id from public.worker_services
);

-- Show what's left so we can eyeball the count
select count(*) as remaining_categories from public.service_categories;
