-- ============================================================
-- FLIPWORK — book missing sales (sold pieces with a price but no ledger sale)
-- 2026-08-11
--
-- Some pieces (the spring raised-bed gardens + a few furniture pieces) were
-- marked sold with a price, but the sale was never recorded as revenue in the
-- ledger — so the dashboard counted them and the books didn't. This books each
-- as a real sale (credit Sales, tagged to the piece), exactly like the app's
-- own "log a sale". Offset goes to the internal Cash on Hand bucket, so it's
-- consistent with every other logged sale and doesn't touch any bank balance.
--
-- Only books pieces that have a real sold DATE (undated ones are held back for
-- review). Query-driven and idempotent — safe to re-run.
--
-- Run in FlipWork Web App, Primary db.
-- ============================================================
do $sb$
declare
  v_uid uuid; v_cash uuid; v_sales uuid; v_txn uuid; rec record; n int := 0; tot numeric := 0;
begin
  select id into v_uid   from auth.users where lower(email) = lower('corythacker@gmail.com');
  select id into v_cash  from public.accounts where owner_user_id = v_uid and name = 'Cash on Hand';
  select id into v_sales from public.accounts where owner_user_id = v_uid and name = 'Sales';
  if v_uid is null or v_cash is null or v_sales is null then raise exception 'Missing account.'; end if;

  for rec in
    select ip.id, ip.title, ip.sale_price, ip.sold_at::date as d
    from public.inventory_pieces ip
    where ip.owner_user_id = v_uid
      and ip.stage = 'sold'
      and ip.sale_price > 0
      and ip.sold_at is not null
      and not exists (
        select 1 from public.transactions t
        where t.owner_user_id = v_uid and t.piece_id = ip.id and t.memo = 'sale:' || ip.id)
  loop
    insert into public.transactions (owner_user_id, date, description, memo, piece_id)
    values (v_uid, rec.d, 'Sold: ' || coalesce(nullif(rec.title, ''), 'piece'), 'sale:' || rec.id, rec.id)
    returning id into v_txn;
    insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
    values (v_uid, v_txn, v_cash, rec.sale_price, 0),
           (v_uid, v_txn, v_sales, 0, rec.sale_price);
    n := n + 1; tot := tot + rec.sale_price;
  end loop;
  raise notice 'Booked % missing sales totaling %.', n, tot;
end
$sb$;

-- Verify: Sales should climb by the booked amount.
select round(sum(el.credit - el.debit), 2) as sales_now
from public.entry_lines el
join public.accounts a on a.id = el.account_id
join auth.users u on u.id = el.owner_user_id
where lower(u.email) = 'corythacker@gmail.com' and a.name = 'Sales';
