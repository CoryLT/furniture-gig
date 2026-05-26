-- ============================================================
-- Verified Users — 2026-05-26
-- ============================================================
-- Adds a SECURITY DEFINER function `is_user_verified(uuid)` that
-- returns true for any user who has cleared a real-money trust gate:
--
--   • Workers: their Stripe Connect Express account is fully active
--     (charges_enabled = true AND payouts_enabled = true). Stripe
--     has verified their identity / SSN / bank.
--
--   • Flippers: they have at least one payout_records row where
--     payment_status indicates real money moved through the
--     platform on their card (captured / transferred / refunded).
--     A real card on a real charge = real person.
--
-- Returns true if EITHER condition holds. A user can be verified
-- as a worker, a flipper, or both.
--
-- Safe to re-run. Idempotent.
-- ============================================================

create or replace function public.is_user_verified(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Verified as a worker (Stripe Connect active)
    exists (
      select 1
      from public.worker_profiles wp
      where wp.user_id = target_user_id
        and wp.stripe_charges_enabled = true
        and wp.stripe_payouts_enabled = true
    )
    or
    -- Verified as a flipper (has paid for at least one gig with real money)
    exists (
      select 1
      from public.payout_records pr
      where pr.flipper_user_id = target_user_id
        and pr.payment_status in ('captured', 'transferred', 'refunded')
    );
$$;

-- Let logged-in users AND anonymous visitors call this. Anon needs it
-- because public profile pages are visible without login.
grant execute on function public.is_user_verified(uuid) to anon, authenticated;

comment on function public.is_user_verified(uuid) is
  'Returns true if the user has cleared a real-money trust gate: either Stripe Connect is active (worker) or they have at least one captured payment (flipper). Used to display a verified checkmark on public-facing UI.';
