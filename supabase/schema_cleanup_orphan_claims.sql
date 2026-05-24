-- ============================================================
-- Clean up orphan gig_claims
-- ============================================================
-- The gig_claims.gig_id FK is declared `on delete cascade`, so in a
-- healthy schema a claim is automatically removed when its gig is
-- deleted. If the schema was patched at some point and the cascade
-- got dropped (e.g. a "drop constraint" + "add constraint" without
-- the on-delete clause), orphan claim rows can exist. They show
-- up as ghost counts on a worker's My Gigs page.
--
-- This file:
--   1) Deletes any gig_claim rows whose gig_id no longer exists.
--   2) Verifies / re-asserts the on-delete-cascade behavior so the
--      same orphan can't reappear next time you delete a gig.
--
-- Safe to re-run any time.
-- ============================================================

-- 1. Wipe orphans
delete from public.gig_claims
where gig_id not in (select id from public.gigs);

-- 2. Make sure the FK still has on-delete-cascade.
-- (Postgres won't let us "alter" an FK in place, so we drop and re-add
-- it. The constraint name below matches the default name Postgres
-- gives to FKs created in the original schema. If the constraint
-- name is different in your DB, this block will no-op the drop and
-- still add a new one — also fine.)
do $$
begin
  -- Drop whichever variant exists.
  if exists (
    select 1 from pg_constraint
    where conname = 'gig_claims_gig_id_fkey'
  ) then
    alter table public.gig_claims drop constraint gig_claims_gig_id_fkey;
  end if;

  -- Re-add with the desired cascade behavior. Use a fixed name so
  -- subsequent runs of this file remain idempotent.
  alter table public.gig_claims
    add constraint gig_claims_gig_id_fkey
    foreign key (gig_id)
    references public.gigs(id)
    on delete cascade;
end$$;

-- 3. Done. You should see "Success. No rows returned."
