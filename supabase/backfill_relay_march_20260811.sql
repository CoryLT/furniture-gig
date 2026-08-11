-- ============================================================
-- FLIPWORK — backfill Relay owner draws/contributions for March 2026
-- 2026-08-11
--
-- Fills the March "Took out" gap on the Owner money card. In March you were on
-- Relay; the only money that actually left the business to your personal side
-- was two transfers to your WAY2SAVE savings ($170), plus $40 moved back in.
-- We book just those owner moves; the offset goes to the hidden internal bucket
-- so your Wells Fargo balance is untouched. Materials/sales from Relay are not
-- pulled in here (that's a separate question).
--
-- Run in FlipWork Web App, Primary db. SAFE TO RE-RUN.
-- ============================================================

do $rl$
declare
  v_uid uuid; v_txn uuid; v_debit uuid; v_credit uuid; rec record; n int := 0;
begin
  select id into v_uid from auth.users where lower(email) = lower('corythacker@gmail.com');
  if v_uid is null then raise exception 'No account for corythacker@gmail.com'; end if;

  delete from public.transactions where owner_user_id = v_uid and memo = 'relay-march-backfill';

  for rec in select * from (values
    ('2026-03-21'::date, 'Relay: owner withdrawal to savings (ACH Push)', 'Owner''s Draws',         'Cash on Hand',            60.00),
    ('2026-03-21'::date, 'Relay: owner withdrawal to savings',           'Owner''s Draws',         'Cash on Hand',           110.00),
    ('2026-03-16'::date, 'Relay: contribution from savings (ACH Pull)',  'Cash on Hand',           'Owner''s Contributions',  20.00),
    ('2026-03-06'::date, 'Relay: contribution from savings (ACH Pull)',  'Cash on Hand',           'Owner''s Contributions',  20.00)
  ) as t(d, descr, debit_acct, credit_acct, amt)
  loop
    select id into v_debit  from public.accounts where owner_user_id = v_uid and name = rec.debit_acct;
    select id into v_credit from public.accounts where owner_user_id = v_uid and name = rec.credit_acct;
    if v_debit is null or v_credit is null then
      raise exception 'Missing bucket: % / %', rec.debit_acct, rec.credit_acct;
    end if;
    insert into public.transactions (owner_user_id, date, description, memo)
    values (v_uid, rec.d, rec.descr, 'relay-march-backfill') returning id into v_txn;
    insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
    values (v_uid, v_txn, v_debit, rec.amt, 0),
           (v_uid, v_txn, v_credit, 0, rec.amt);
    n := n + 1;
  end loop;
  raise notice 'Loaded % Relay owner-money entries for March.', n;
end
$rl$;

-- Verify: March draws and contributions now on the books.
select to_char(t.date,'YYYY-MM') as month, a.name,
       sum(el.debit) as debits, sum(el.credit) as credits
from public.entry_lines el
join public.accounts a on a.id = el.account_id
join public.transactions t on t.id = el.transaction_id
join auth.users u on u.id = el.owner_user_id
where lower(u.email) = 'corythacker@gmail.com'
  and a.name in ('Owner''s Draws','Owner''s Contributions')
  and to_char(t.date,'YYYY-MM') = '2026-03'
group by 1, a.name order by a.name;
