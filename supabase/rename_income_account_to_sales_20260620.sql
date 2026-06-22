-- ============================================================
-- FLIPWORK — rename income bucket "Furniture Sales" -> "Sales"  —  2026-06-20
-- ============================================================
-- More general name. Safe: a sale finds its income account by matching any
-- income account whose name contains "sale" (case-insensitive), and "Sales"
-- still matches, so recording sales keeps working.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

update public.accounts
   set name = 'Sales'
 where type = 'income'
   and name = 'Furniture Sales';

-- ============================================================
-- End
-- ============================================================
