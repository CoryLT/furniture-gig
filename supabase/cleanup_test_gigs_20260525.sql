-- ============================================================
-- FlipWork — Cleanup of 12 test gigs (May 25, 2026)
-- ============================================================
-- Removes the 12 admin-created test gigs that were cluttering
-- the marketplace before public launch.
--
-- Safety:
--   - Identifies gigs to remove by their EXACT title (12 known
--     test titles below). No wildcard matching.
--   - Any matched gig with Stripe payment activity in
--     payout_records gets ARCHIVED instead of deleted, so we
--     never erase a row that documents real money.
--   - Everything else is hard-deleted. Cascade FKs handle
--     claims, checklist items, photos, conversations, etc.
--
-- This file is safe to re-run: the WHERE clauses match titles,
-- and on a second run there are simply no matching rows.
-- ============================================================

-- The 12 test gigs Cory confirmed for cleanup.
-- (Defined once as a CTE so we don't repeat the list.)
with targets as (
  select id, title, status
  from public.gigs
  where title in (
    'Repaint Pink Chest',
    'Quick Gig! 2 Nightstands',
    'Quick Flip! Chest of Drawers',
    'blah',
    'Broken Dresser',
    'Oak Dresser',
    'dresser',
    'ssdfas',
    'tttttt',
    'rtyutut',
    'fghjfghjt',
    'MCM Chest of Drawers'
  )
),
-- Gigs that have ever touched real Stripe money. These get
-- archived, not deleted.
money_touched as (
  select distinct t.id
  from targets t
  join public.payout_records p on p.gig_id = t.id
  where p.payment_status in ('authorized','captured','transferred','refunded','failed')
     or p.payout_status in ('paid','pending')
)
-- Step 1: Archive any money-touched gig (keep its history).
update public.gigs
   set status = 'archived',
       updated_at = now()
 where id in (select id from money_touched)
   and status <> 'archived';

-- Step 2: Hard-delete the rest. Cascade FKs handle:
--   gig_claims, gig_checklist_items, gig_task_completions,
--   gig_photo_uploads, gig_images, payout_records (only the
--   ones with no Stripe activity at this point), gig_conversations,
--   gig_messages.
delete from public.gigs
 where title in (
   'Repaint Pink Chest',
   'Quick Gig! 2 Nightstands',
   'Quick Flip! Chest of Drawers',
   'blah',
   'Broken Dresser',
   'Oak Dresser',
   'dresser',
   'ssdfas',
   'tttttt',
   'rtyutut',
   'fghjfghjt',
   'MCM Chest of Drawers'
 )
   and id not in (
     select gig_id from public.payout_records
      where payment_status in ('authorized','captured','transferred','refunded','failed')
         or payout_status in ('paid','pending')
   );

-- ============================================================
-- Report — run this to see what's left of the 12 titles
-- ============================================================
select title, status, updated_at
  from public.gigs
 where title in (
   'Repaint Pink Chest',
   'Quick Gig! 2 Nightstands',
   'Quick Flip! Chest of Drawers',
   'blah',
   'Broken Dresser',
   'Oak Dresser',
   'dresser',
   'ssdfas',
   'tttttt',
   'rtyutut',
   'fghjfghjt',
   'MCM Chest of Drawers'
 )
 order by status, title;
-- If this returns ZERO rows → all 12 were hard-deleted (no Stripe activity).
-- If it returns 1+ rows with status='archived' → those touched Stripe
-- and were safely archived instead. That's expected for "Quick Flip!
-- Chest of Drawers" if it has a real captured payment.
