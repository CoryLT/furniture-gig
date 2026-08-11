-- ============================================================
-- FLIPWORK — backfill hardware supplies bought on the PERSONAL card
-- 2026-08-11
--
-- Feb–May 2026: Cory bought business supplies (Lowe's hardware, Home Depot,
-- Harbor Freight, Ace) on his personal Wells Fargo checking during the gap
-- before the business account existed. This logs each one as:
--     Materials & Supplies  (expense, up)   <- the cost
--     Owner's Contributions (equity,  up)   <- he funded it from his own pocket
-- The single Lowe's return is booked the opposite way (both down).
-- Grocery "Lowe's Foods" was excluded. Net logged: $3,637.73 across 47 lines.
--
-- Run in the FlipWork Web App Supabase project, Primary db. SAFE TO RE-RUN
-- (it clears any prior run of this same backfill first).
-- ============================================================

do $hw$
declare
  v_uid uuid;
  v_mat uuid;
  v_own uuid;
  v_txn uuid;
  rec   record;
  n     int := 0;
begin
  select id into v_uid from auth.users where lower(email) = lower('corythacker@gmail.com');
  if v_uid is null then raise exception 'No account found for corythacker@gmail.com'; end if;

  select id into v_mat from public.accounts where owner_user_id = v_uid and name = 'Materials & Supplies';
  select id into v_own from public.accounts where owner_user_id = v_uid and name = 'Owner''s Contributions';
  if v_mat is null then raise exception 'No "Materials & Supplies" bucket found for this account.'; end if;
  if v_own is null then raise exception 'No "Owner''s Contributions" bucket found for this account.'; end if;

  -- Clear any prior run of THIS backfill (entry_lines cascade with the txn).
  delete from public.transactions where owner_user_id = v_uid and memo = 'personal-supplies-backfill';

  for rec in
    select * from (values
    ('2026-02-09'::date, 'Lowe''s', 22.35, false),
    ('2026-02-11'::date, 'Lowe''s', 23.17, false),
    ('2026-02-11'::date, 'Lowe''s', 22.35, true),
    ('2026-02-13'::date, 'Ace Hardware', 26.68, false),
    ('2026-02-16'::date, 'Lowe''s', 18.64, false),
    ('2026-02-17'::date, 'Ace Hardware', 21.34, false),
    ('2026-02-17'::date, 'Ace Hardware', 9.60, false),
    ('2026-02-20'::date, 'Ace Hardware', 30.05, false),
    ('2026-02-26'::date, 'Ace Hardware', 5.33, false),
    ('2026-03-06'::date, 'Harbor Freight', 92.49, false),
    ('2026-03-09'::date, 'Ace Hardware', 131.31, false),
    ('2026-03-10'::date, 'Lowe''s', 24.21, false),
    ('2026-03-11'::date, 'Lowe''s', 23.46, false),
    ('2026-03-11'::date, 'Lowe''s', 18.13, false),
    ('2026-03-14'::date, 'Lowe''s', 50.51, false),
    ('2026-03-14'::date, 'Ace Hardware', 22.43, false),
    ('2026-04-02'::date, 'Lowe''s', 3.18, false),
    ('2026-04-04'::date, 'Lowe''s', 116.81, false),
    ('2026-04-10'::date, 'Lowe''s', 128.00, false),
    ('2026-04-13'::date, 'Lowe''s', 53.08, false),
    ('2026-04-13'::date, 'Lowe''s', 60.26, false),
    ('2026-04-14'::date, 'Lowe''s', 244.20, false),
    ('2026-04-14'::date, 'Ace Hardware', 35.22, false),
    ('2026-04-17'::date, 'Lowe''s', 116.05, false),
    ('2026-04-17'::date, 'Lowe''s', 68.88, false),
    ('2026-04-19'::date, 'Lowe''s', 8.32, false),
    ('2026-04-20'::date, 'Harbor Freight', 109.35, false),
    ('2026-04-20'::date, 'Lowe''s', 327.10, false),
    ('2026-04-20'::date, 'Lowe''s', 50.28, false),
    ('2026-04-20'::date, 'Ace Hardware', 13.86, false),
    ('2026-04-21'::date, 'Lowe''s', 8.52, false),
    ('2026-04-22'::date, 'Lowe''s', 13.19, false),
    ('2026-04-23'::date, 'Lowe''s', 257.87, false),
    ('2026-04-25'::date, 'Lowe''s', 110.00, false),
    ('2026-04-25'::date, 'Ace Hardware', 11.49, false),
    ('2026-04-27'::date, 'Lowe''s', 461.50, false),
    ('2026-04-27'::date, 'Lowe''s', 74.30, false),
    ('2026-04-28'::date, 'Lowe''s', 103.12, false),
    ('2026-04-29'::date, 'Lowe''s', 130.35, false),
    ('2026-04-29'::date, 'Harbor Freight', 18.21, false),
    ('2026-04-29'::date, 'Home Depot', 10.57, false),
    ('2026-04-29'::date, 'Ace Hardware', 19.20, false),
    ('2026-04-30'::date, 'Harbor Freight', 91.08, false),
    ('2026-04-30'::date, 'Lowe''s', 287.71, false),
    ('2026-05-01'::date, 'Lowe''s', 151.01, false),
    ('2026-05-01'::date, 'Home Depot', 34.74, false),
    ('2026-05-04'::date, 'Lowe''s', 22.93, false)
    ) as t(d, store, amt, is_return)
  loop
    insert into public.transactions (owner_user_id, date, description, memo)
    values (
      v_uid, rec.d,
      rec.store || case when rec.is_return then ' — supplies refund (personal card)'
                        else ' — supplies paid on personal card' end,
      'personal-supplies-backfill'
    )
    returning id into v_txn;

    if rec.is_return then
      insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
      values (v_uid, v_txn, v_own, rec.amt, 0),
             (v_uid, v_txn, v_mat, 0, rec.amt);
    else
      insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
      values (v_uid, v_txn, v_mat, rec.amt, 0),
             (v_uid, v_txn, v_own, 0, rec.amt);
    end if;
    n := n + 1;
  end loop;

  raise notice 'Logged % personal-card hardware entries.', n;
end
$hw$;

-- Confirm: should show 47 entries and materials_net = 3637.73
select count(distinct t.id)                                            as entries,
       sum(el.debit - el.credit) filter (where a.name = 'Materials & Supplies') as materials_net
from public.transactions t
join public.entry_lines el on el.transaction_id = t.id
join public.accounts a     on a.id = el.account_id
join auth.users u          on u.id = t.owner_user_id
where lower(u.email) = 'corythacker@gmail.com'
  and t.memo = 'personal-supplies-backfill';
