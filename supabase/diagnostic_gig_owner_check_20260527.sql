-- ============================================================
-- Verify dashboard query scoping
-- ============================================================
-- The dashboard's Paid Out tile filters payout_records to
-- `gigs.poster_user_id = current_user`. If poster_user_id is
-- null on the paid gigs (only created_by is set, for example),
-- the tile silently returns nothing.
-- ============================================================

select
  g.id           as gig_id,
  g.title,
  g.status       as gig_status,
  g.poster_user_id,
  g.created_by,
  g.pay_amount,
  -- which fallback matches the admin user
  case
    when g.poster_user_id = 'ae847095-eaeb-4522-8cb3-001553933bf1'::uuid
      then 'poster_user_id matches'
    when g.created_by = 'ae847095-eaeb-4522-8cb3-001553933bf1'::uuid
     and g.poster_user_id is null
      then 'only created_by matches (poster is NULL)'
    when g.created_by = 'ae847095-eaeb-4522-8cb3-001553933bf1'::uuid
      then 'created_by matches AND poster_user_id is also set'
    else 'NEITHER matches Cory'
  end            as ownership_check
from public.gigs g
where g.id in (
  select gig_id from public.payout_records where payout_status = 'paid'
);
