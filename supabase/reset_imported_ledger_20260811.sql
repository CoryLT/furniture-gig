-- ============================================================
-- FLIPWORK — clear imported statement entries for a clean rebuild
-- 2026-08-11
--
-- The old importer logic drifted "Money on hand" (inflated Bank, negative
-- Cash on Hand). This removes ONLY the ledger entries the importer created
-- (they're linked from the bank feed) and empties the feed, so the WF bank
-- can be rebuilt cleanly by re-importing statements with the fixed logic.
--
-- LEFT UNTOUCHED: anything you logged by hand (pieces, sales, expenses) and
-- the personal-hardware backfill — none of those are linked from the feed.
--
-- Run in the FlipWork Web App Supabase project, Primary db. Safe to re-run.
-- ============================================================

do $rst$
declare
  v_uid  uuid;
  n_txn  int;
  n_feed int;
begin
  select id into v_uid from auth.users where lower(email) = lower('corythacker@gmail.com');
  if v_uid is null then raise exception 'No account found for corythacker@gmail.com'; end if;

  -- Delete ledger entries the importer made (entry_lines cascade with the txn).
  with imp as (
    select distinct transaction_id
    from public.books_bank_feed
    where owner_user_id = v_uid and transaction_id is not null
  )
  delete from public.transactions t
  using imp
  where t.id = imp.transaction_id
    and t.owner_user_id = v_uid;
  get diagnostics n_txn = row_count;

  -- Empty the bank feed so a fresh re-import starts clean.
  delete from public.books_bank_feed where owner_user_id = v_uid;
  get diagnostics n_feed = row_count;

  raise notice 'Removed % imported ledger entries and cleared % feed rows.', n_txn, n_feed;
end
$rst$;

-- Check: Bank / Checking should be back near 0 (it rebuilds on re-import).
select a.name,
       sum(el.debit - el.credit) as balance,
       count(*)                  as lines
from public.accounts a
join public.entry_lines el on el.account_id = a.id
join auth.users u          on u.id = a.owner_user_id
where lower(u.email) = 'corythacker@gmail.com'
  and a.type = 'asset'
group by a.name
order by a.name;
