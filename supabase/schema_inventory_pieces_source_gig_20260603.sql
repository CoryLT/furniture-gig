-- ============================================================
-- FlipWork — Link pipeline pieces to the job they came from
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- When a job auto-creates a pipeline piece, we now stamp the piece with
-- the job's id. That lets "Mark as paid" later write the real amount paid
-- onto the right piece's cost, keeping your profit numbers accurate.

alter table public.inventory_pieces
  add column if not exists source_gig_id uuid references public.gigs(id) on delete set null;

create index if not exists inventory_pieces_source_gig_idx
  on public.inventory_pieces (source_gig_id);
