-- ============================================================
-- Gig Payments + Pay-Handle Visibility — 2026-05-30
-- ============================================================
-- The poster pays the worker DIRECTLY (Cash App/Venmo/etc.). FlipWork
-- does not move the money. This migration adds:
--
--   1) gig_payments — records that a poster marked a gig paid, by what
--      method, and the worker's confirmation back (the two-sided
--      handshake). One row per gig. This is also the start of the
--      tax-time record for both sides.
--
--   2) An RLS rule so a poster who has actually booked a worker can
--      finally SEE that worker's pay handles. Until now only the worker
--      could read their own — this keeps handles private on public
--      profiles but visible to a poster who's hired them.
--
-- Safe to re-run. Idempotent.
-- ============================================================

-- 1) Payment record + handshake (one row per gig)
create table if not exists public.gig_payments (
  gig_id              uuid primary key references public.gigs(id) on delete cascade,
  worker_user_id      uuid references public.users(id) on delete set null,
  flipper_user_id     uuid references public.users(id) on delete set null,
  amount              numeric(10,2),
  method              text check (method in ('cashapp','venmo','paypal','zelle','cash','other')),
  marked_paid_at      timestamptz,
  worker_confirmed_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.gig_payments enable row level security;

-- Both parties on the gig can read the payment record.
drop policy if exists "payment parties can read" on public.gig_payments;
create policy "payment parties can read" on public.gig_payments for select
  using (flipper_user_id = auth.uid() or worker_user_id = auth.uid());

-- The poster creates the record when they mark the gig paid.
drop policy if exists "poster can create payment" on public.gig_payments;
create policy "poster can create payment" on public.gig_payments for insert
  with check (flipper_user_id = auth.uid());

-- Either party can update it: the poster sets paid details, the worker
-- confirms receipt. (App controls which fields each side touches.)
drop policy if exists "parties can update payment" on public.gig_payments;
create policy "parties can update payment" on public.gig_payments for update
  using (flipper_user_id = auth.uid() or worker_user_id = auth.uid())
  with check (flipper_user_id = auth.uid() or worker_user_id = auth.uid());

-- 2) Let a poster who has booked this worker read their pay handles.
--    (This is ADDED alongside the existing "worker manages own" rule —
--    for SELECT, Postgres allows the row if EITHER rule passes, so the
--    worker still reads their own and a booked poster can read too.)
drop policy if exists "booked poster can read worker payout handles" on public.worker_payout_handles;
create policy "booked poster can read worker payout handles"
  on public.worker_payout_handles for select
  using (
    exists (
      select 1
      from public.gig_claims gc
      join public.gigs g on g.id = gc.gig_id
      where gc.worker_user_id = worker_payout_handles.user_id
        and gc.status in ('active', 'submitted_for_review', 'approved')
        and (g.poster_user_id = auth.uid() or g.created_by = auth.uid())
    )
  );

comment on table public.gig_payments is
  'Off-platform payment record + two-sided handshake for a booked gig. FlipWork does not process the money; the poster pays the worker directly and both confirm receipt here.';
