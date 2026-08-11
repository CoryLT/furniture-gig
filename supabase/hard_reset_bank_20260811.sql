-- ============================================================
-- FLIPWORK — hard reset of the Bank / Checking bucket
-- 2026-08-11
--
-- The earlier cleanup only removed imported entries still linked from the bank
-- feed; earlier runs had emptied that feed, orphaning a lot of junk it couldn't
-- find. This clears the bank completely by deleting EVERY transaction that
-- touches Bank / Checking (entry_lines cascade with the txn), then empties the
-- feed. The bank is then rebuilt cleanly when you re-import your WF statements.
--
-- SAFE — leaves alone anything that doesn't touch the bank bucket:
--   • your logged sales / pieces (they live in Cash on Hand)
--   • the personal hardware backfill (Materials + Owner's Contributions)
--
-- Run in the FlipWork Web App Supabase project, Primary db. Safe to re-run.
-- ============================================================

do $rst$
declare
  v_uid uuid;
  n     int;
begin
  select id into v_uid from auth.users where lower(email) = lower('corythacker@gmail.com');
  if v_uid is null then raise exception 'No account found for corythacker@gmail.com'; end if;

  with bank as (
    select id from public.accounts
    where owner_user_id = v_uid and name = 'Bank / Checking'
  ),
  hit as (
    select distinct el.transaction_id
    from public.entry_lines el
    join bank on bank.id = el.account_id
    where el.owner_user_id = v_uid
  )
  delete from public.transactions t
  using hit
  where t.id = hit.transaction_id
    and t.owner_user_id = v_uid;
  get diagnostics n = row_count;

  delete from public.books_bank_feed where owner_user_id = v_uid;

  raise notice 'Removed % bank-touching entries. Bank / Checking is reset to 0.', n;
end
$rst$;

-- Verify: Bank / Checking should read 0 now (Cash on Hand is untouched).
select a.name, coalesce(sum(el.debit - el.credit), 0) as balance
from public.accounts a
left join public.entry_lines el on el.account_id = a.id
join auth.users u on u.id = a.owner_user_id
where lower(u.email) = 'corythacker@gmail.com'
  and a.type = 'asset'
group by a.name
order by a.name;
