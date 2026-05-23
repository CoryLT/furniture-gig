-- ============================================================
-- STRIPE CONNECT PHASE 7 — webhooks
-- ============================================================
-- Adds a log table for incoming Stripe webhook events.
--
-- Why a log table?
--   1) Stripe can deliver the SAME event more than once (network retries).
--      We use the event ID as a unique key to make our handler idempotent —
--      if we see the same event twice, we just no-op the second time.
--   2) It's an audit trail. When something weird happens in payments, we
--      can look here and see exactly what Stripe told us and when.
--
-- Safe to re-run.
-- ============================================================

create table if not exists public.stripe_webhook_events (
  -- Stripe's own event ID (e.g. evt_1Nxxxxxx). Unique = idempotency.
  id              text primary key,

  -- The event type, e.g. "payment_intent.succeeded".
  type            text not null,

  -- Stripe's API version used to render the event payload.
  api_version     text,

  -- When Stripe created the event (Stripe's clock).
  stripe_created_at timestamptz,

  -- When we received it (our clock).
  received_at     timestamptz not null default now(),

  -- When we finished processing it. Null = still in-flight or errored.
  processed_at    timestamptz,

  -- Did we successfully handle it?
  status          text not null default 'received'
    check (status in (
      'received',   -- row created, not yet handled
      'processed',  -- handler ran cleanly
      'ignored',    -- event type we don't care about
      'error'       -- handler threw; check error_message
    )),

  -- If status='error', the message we caught.
  error_message   text,

  -- Full event payload as JSON. Useful for debugging without re-querying Stripe.
  payload         jsonb not null
);

-- Index on type for "show me all transfer.failed events" queries.
create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (type);

-- Index on received_at for time-windowed queries.
create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

-- ============================================================
-- RLS
-- ============================================================
-- Only admins should ever read this. The webhook handler itself uses the
-- service role key, which bypasses RLS entirely, so no policy is needed
-- for writes from the handler.

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "Admins can view stripe webhook events"
  on public.stripe_webhook_events;

create policy "Admins can view stripe webhook events"
  on public.stripe_webhook_events for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
    )
  );

-- ============================================================
-- DONE
-- ============================================================
