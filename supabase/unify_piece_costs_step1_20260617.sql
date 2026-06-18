-- ============================================================
-- Unify piece costs into the ledger — STEP 1 (safe, non-breaking)
-- 2026-06-17 · Run in Supabase: SQL Editor → New query → paste → Run.
-- ============================================================
-- This copies your existing piece costs into the Books ledger so the
-- ledger becomes the ONE place every cost lives:
--   • each piece_expenses row  -> a ledger expense tagged to that piece
--   • each piece's purchase price -> a "Pieces Purchased" ledger expense
--
-- It does NOT change the app yet and does NOT delete piece_expenses, so
-- your current numbers keep working. The final SELECT shows old vs new
-- per piece — they should match before we flip the app over.
--
-- Idempotent: re-running won't double up (each migrated row is marked).
-- ============================================================

-- 1) The new single source of truth for a piece's cost: the ledger.
create or replace view public.piece_costs
with (security_invoker = true) as
select
  t.piece_id,
  t.owner_user_id,
  coalesce(sum(el.debit - el.credit), 0) as total_cost
from public.transactions t
join public.entry_lines el on el.transaction_id = t.id
join public.accounts a on a.id = el.account_id and a.type = 'expense'
where t.piece_id is not null
group by t.piece_id, t.owner_user_id;

-- 2) Backfill: move existing piece costs into the ledger.
do $$
declare
  r       record;
  v_exp   uuid;
  v_cash  uuid;
  v_txn   uuid;
  v_name  text;
begin
  -- 2a) per-piece add-on expenses
  for r in
    select pe.id, pe.piece_id, ip.owner_user_id, pe.amount, pe.category, pe.note, pe.spent_on
    from public.piece_expenses pe
    join public.inventory_pieces ip on ip.id = pe.piece_id
    where coalesce(pe.amount, 0) > 0
  loop
    if exists (select 1 from public.transactions
               where owner_user_id = r.owner_user_id and memo = 'mig:pe:' || r.id) then
      continue;
    end if;

    v_name := case r.category
      when 'materials'  then 'Materials & Supplies'
      when 'labor'      then 'Labor — Crew'
      when 'transport'  then 'Transport & Gas'
      when 'fees'       then 'Listing & Selling Fees'
      when 'purchase'   then 'Pieces Purchased'
      else 'Office & Admin'
    end;

    select id into v_exp from public.accounts
      where owner_user_id = r.owner_user_id and type = 'expense' and name = v_name limit 1;
    if v_exp is null then
      select id into v_exp from public.accounts
        where owner_user_id = r.owner_user_id and type = 'expense' order by name limit 1;
    end if;
    select id into v_cash from public.accounts
      where owner_user_id = r.owner_user_id and type = 'asset'
      order by (name <> 'Cash on Hand'), name limit 1;
    if v_exp is null or v_cash is null then continue; end if;

    insert into public.transactions (owner_user_id, date, description, memo, piece_id)
    values (r.owner_user_id, coalesce(r.spent_on, current_date),
            coalesce(nullif(r.note, ''), initcap(coalesce(r.category, 'expense'))),
            'mig:pe:' || r.id, r.piece_id)
    returning id into v_txn;

    insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
    values (r.owner_user_id, v_txn, v_exp,  r.amount, 0),
           (r.owner_user_id, v_txn, v_cash, 0,        r.amount);
  end loop;

  -- 2b) purchase price of each piece
  for r in
    select ip.id as piece_id, ip.owner_user_id, ip.acquisition_cost, ip.created_at, ip.title
    from public.inventory_pieces ip
    where coalesce(ip.acquisition_cost, 0) > 0
  loop
    if exists (select 1 from public.transactions
               where owner_user_id = r.owner_user_id and memo = 'mig:acq:' || r.piece_id) then
      continue;
    end if;

    select id into v_exp from public.accounts
      where owner_user_id = r.owner_user_id and type = 'expense' and name = 'Pieces Purchased' limit 1;
    if v_exp is null then
      select id into v_exp from public.accounts
        where owner_user_id = r.owner_user_id and type = 'expense' order by name limit 1;
    end if;
    select id into v_cash from public.accounts
      where owner_user_id = r.owner_user_id and type = 'asset'
      order by (name <> 'Cash on Hand'), name limit 1;
    if v_exp is null or v_cash is null then continue; end if;

    insert into public.transactions (owner_user_id, date, description, memo, piece_id)
    values (r.owner_user_id, coalesce(r.created_at::date, current_date),
            'Bought: ' || coalesce(r.title, 'piece'),
            'mig:acq:' || r.piece_id, r.piece_id)
    returning id into v_txn;

    insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
    values (r.owner_user_id, v_txn, v_exp,  r.acquisition_cost, 0),
           (r.owner_user_id, v_txn, v_cash, 0,                  r.acquisition_cost);
  end loop;
end $$;

-- 3) VERIFY: old cost (column + piece_expenses) vs new cost (ledger view).
--    Every row's old_cost should equal new_cost.
select
  ip.title,
  coalesce(ip.acquisition_cost, 0)
    + coalesce((select sum(amount) from public.piece_expenses pe where pe.piece_id = ip.id), 0) as old_cost,
  coalesce((select total_cost from public.piece_costs pc where pc.piece_id = ip.id), 0)         as new_cost
from public.inventory_pieces ip
order by ip.created_at desc;
