-- ============================================================
-- FLIPWORK — fix Sales double-count from imported bank deposits
-- 2026-08-11
--
-- The WF import booked sale-deposits as NEW Sales income, but those sales were
-- already logged piece-by-piece. So the deposit is the same money arriving in
-- the bank, not a second sale. We re-point those deposit credits from Sales to
-- the hidden Cash on Hand bucket (turning them into "money arrived" transfers).
-- Bank balance is untouched; Sales drops to the real logged figure.
--
-- Run in FlipWork Web App, Primary db. SAFE TO RE-RUN (idempotent).
-- ============================================================
do $fix$
declare v_uid uuid; v_sales uuid; v_cash uuid; n int;
begin
  select id into v_uid   from auth.users where lower(email) = lower('corythacker@gmail.com');
  select id into v_sales from public.accounts where owner_user_id = v_uid and name = 'Sales';
  select id into v_cash  from public.accounts where owner_user_id = v_uid and name = 'Cash on Hand';
  if v_uid is null or v_sales is null or v_cash is null then raise exception 'Missing account.'; end if;

  update public.entry_lines el
  set account_id = v_cash
  where el.owner_user_id = v_uid
    and el.account_id = v_sales
    and el.transaction_id in (
      select id from public.transactions
      where owner_user_id = v_uid and memo = 'wf-business-backfill');
  get diagnostics n = row_count;
  raise notice 'Re-pointed % imported sale deposits out of Sales (double-count removed).', n;
end $fix$;

-- Verify: Sales should now be your real logged revenue (~20,514.98).
select round(sum(el.credit - el.debit), 2) as sales_now
from public.entry_lines el
join public.accounts a on a.id = el.account_id
join auth.users u on u.id = el.owner_user_id
where lower(u.email) = lower('corythacker@gmail.com') and a.name = 'Sales';
