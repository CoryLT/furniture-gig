-- ============================================================
-- Let gig posters (flippers) view payout records on their gigs
-- 2026-05-27
-- ============================================================
-- The flipper dashboard's "Paid Out" stat tile needs to total
-- the actual money paid through Stripe for gigs the flipper
-- posted. The source of truth is the payout_records table
-- (specifically rows with payout_status='paid'), but the
-- original RLS on this table only allowed:
--   1. The worker themselves to read their own rows
--   2. Admin to read all rows
-- There was no policy letting the gig poster see payouts on
-- their own gigs. So a non-admin flipper's query would silently
-- return 0 rows and the tile would always show $0.
--
-- Fix: add a SELECT policy for the gig poster, scoped to gigs
-- they actually posted. Read-only — they cannot modify payout
-- records, only the admin role and the Stripe capture-payment
-- API (which uses service-role) can write to this table.
--
-- Idempotent. Safe to re-run.
-- ============================================================

drop policy if exists "Gig posters can view payouts on their gigs"
  on public.payout_records;

create policy "Gig posters can view payouts on their gigs"
  on public.payout_records for select
  using (
    exists (
      select 1
        from public.gigs g
       where g.id = payout_records.gig_id
         and coalesce(g.poster_user_id, g.created_by) = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- Report: list policies on the table so you can eyeball that
-- the new one is in place after running this.
-- ------------------------------------------------------------
select policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename  = 'payout_records'
 order by policyname;
