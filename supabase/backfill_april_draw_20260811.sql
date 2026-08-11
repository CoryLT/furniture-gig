-- ============================================================
-- FLIPWORK — April owner draw (commingled month, no business account)
-- 2026-08-11
--
-- April ran entirely through Cory's personal account, so there were no
-- business->personal transfers to measure. Per Cory's call, the flip business's
-- April earnings count as money taken out. We use his LOGGED April furniture
-- sales ($6,714.98) — furniture only, from his own records — as the draw.
-- The offset is the hidden internal bucket (where his logged sales already sit),
-- so it nets clean and the Wells Fargo balance is untouched.
--
-- Run in FlipWork Web App, Primary db. SAFE TO RE-RUN.
-- ============================================================

do $ap$
declare
  v_uid uuid; v_txn uuid; v_draw uuid; v_cash uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower('corythacker@gmail.com');
  if v_uid is null then raise exception 'No account for corythacker@gmail.com'; end if;

  select id into v_draw from public.accounts where owner_user_id = v_uid and name = 'Owner''s Draws';
  select id into v_cash from public.accounts where owner_user_id = v_uid and name = 'Cash on Hand';
  if v_draw is null or v_cash is null then raise exception 'Missing Owner''s Draws or Cash on Hand bucket.'; end if;

  delete from public.transactions where owner_user_id = v_uid and memo = 'april-draw-backfill';

  insert into public.transactions (owner_user_id, date, description, memo)
  values (v_uid, '2026-04-30'::date, 'April flip earnings taken out (no business account that month)', 'april-draw-backfill')
  returning id into v_txn;

  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_draw, 6714.98, 0),
         (v_uid, v_txn, v_cash, 0, 6714.98);

  raise notice 'Booked April draw of 6714.98.';
end
$ap$;

-- Verify: April draws and contributions now on the books.
select to_char(t.date,'YYYY-MM') as month, a.name, sum(el.debit) debits, sum(el.credit) credits
from public.entry_lines el
join public.accounts a on a.id = el.account_id
join public.transactions t on t.id = el.transaction_id
join auth.users u on u.id = el.owner_user_id
where lower(u.email) = 'corythacker@gmail.com'
  and a.name in ('Owner''s Draws','Owner''s Contributions')
  and to_char(t.date,'YYYY-MM') = '2026-04'
group by 1, a.name order by a.name;
