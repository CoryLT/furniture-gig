-- ============================================================
-- FlipWork — Make active legal agreements publicly readable
-- ============================================================
-- The original schema's RLS policy on legal_agreements required the
-- viewer to be authenticated:
--
--   using (auth.uid() is not null and active = true)
--
-- That's wrong for legal documents — by industry standard and by
-- common sense, your Terms of Service and Privacy Policy must be
-- readable by anyone (including logged-out visitors, search engines,
-- and people deciding whether to sign up).
--
-- This patch:
--   1. Drops the auth-required SELECT policy.
--   2. Replaces it with a policy that lets anyone read agreements
--      that are currently active.
--   3. Leaves the admin-management policy untouched (admins can
--      still create/edit/deactivate agreements).
--
-- Safe to re-run.
-- ============================================================

-- Drop the old authenticated-only read policy if it exists
drop policy if exists "Anyone authenticated can view active agreements"
  on public.legal_agreements;

-- Also drop any older or alternately-named version, just in case
drop policy if exists "Anyone can view active agreements"
  on public.legal_agreements;

-- New policy: anyone (including anon) can read active agreements
create policy "Anyone can view active agreements"
  on public.legal_agreements for select
  using (active = true);

-- Sanity check after running:
-- select id, title, version, required, active
--   from public.legal_agreements
--  where active = true
--  order by created_at;
