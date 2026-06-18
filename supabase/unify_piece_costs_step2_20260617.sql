-- ============================================================
-- Unify piece costs into the ledger — STEP 2 (functions for the app)
-- 2026-06-17 · Run in Supabase: SQL Editor → New query → paste → Run.
-- Run this BEFORE deploying the matching app code.
-- ============================================================
-- Adds two helpers the app calls so a piece's expense / purchase always
-- lands in the ledger (tagged to the piece). Also re-runs the safe
-- backfill to catch anything logged since step 1.
-- ============================================================

-- 0) Straggler backfill (idempotent — same logic as step 1).
do $$
declare
  r record; v_exp uuid; v_cash uuid; v_txn uuid; v_name text;
begin
  for r in
    select pe.id, pe.piece_id, ip.owner_user_id, pe.amount, pe.category, pe.note, pe.spent_on
    from public.piece_expenses pe
    join public.inventory_pieces ip on ip.id = pe.piece_id
    where coalesce(pe.amount, 0) > 0
  loop
    if exists (select 1 from public.transactions
               where owner_user_id = r.owner_user_id and memo = 'mig:pe:' || r.id) then continue; end if;
    v_name := case r.category
      when 'materials' then 'Materials & Supplies' when 'labor' then 'Labor — Crew'
      when 'transport' then 'Transport & Gas' when 'fees' then 'Listing & Selling Fees'
      when 'purchase' then 'Pieces Purchased' else 'Office & Admin' end;
    select id into v_exp from public.accounts where owner_user_id=r.owner_user_id and type='expense' and name=v_name limit 1;
    if v_exp is null then select id into v_exp from public.accounts where owner_user_id=r.owner_user_id and type='expense' order by name limit 1; end if;
    select id into v_cash from public.accounts where owner_user_id=r.owner_user_id and type='asset' order by (name<>'Cash on Hand'), name limit 1;
    if v_exp is null or v_cash is null then continue; end if;
    insert into public.transactions (owner_user_id, date, description, memo, piece_id)
    values (r.owner_user_id, coalesce(r.spent_on, current_date), coalesce(nullif(r.note,''), initcap(coalesce(r.category,'expense'))), 'mig:pe:'||r.id, r.piece_id)
    returning id into v_txn;
    insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
    values (r.owner_user_id, v_txn, v_exp, r.amount, 0), (r.owner_user_id, v_txn, v_cash, 0, r.amount);
  end loop;

  for r in
    select ip.id as piece_id, ip.owner_user_id, ip.acquisition_cost, ip.created_at, ip.title
    from public.inventory_pieces ip where coalesce(ip.acquisition_cost,0) > 0
  loop
    if exists (select 1 from public.transactions
               where owner_user_id=r.owner_user_id and memo='mig:acq:'||r.piece_id) then continue; end if;
    select id into v_exp from public.accounts where owner_user_id=r.owner_user_id and type='expense' and name='Pieces Purchased' limit 1;
    if v_exp is null then select id into v_exp from public.accounts where owner_user_id=r.owner_user_id and type='expense' order by name limit 1; end if;
    select id into v_cash from public.accounts where owner_user_id=r.owner_user_id and type='asset' order by (name<>'Cash on Hand'), name limit 1;
    if v_exp is null or v_cash is null then continue; end if;
    insert into public.transactions (owner_user_id, date, description, memo, piece_id)
    values (r.owner_user_id, coalesce(r.created_at::date, current_date), 'Bought: '||coalesce(r.title,'piece'), 'mig:acq:'||r.piece_id, r.piece_id)
    returning id into v_txn;
    insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
    values (r.owner_user_id, v_txn, v_exp, r.acquisition_cost, 0), (r.owner_user_id, v_txn, v_cash, 0, r.acquisition_cost);
  end loop;
end $$;

-- helper: resolve this user's expense account for a category name + default cash
create or replace function public._fw_expense_account(p_uid uuid, p_category text)
returns uuid language sql stable as $$
  select coalesce(
    (select id from public.accounts where owner_user_id=p_uid and type='expense' and name =
      case lower(coalesce(p_category,''))
        when 'materials' then 'Materials & Supplies' when 'labor' then 'Labor — Crew'
        when 'transport' then 'Transport & Gas' when 'fees' then 'Listing & Selling Fees'
        when 'purchase' then 'Pieces Purchased' else 'Office & Admin' end limit 1),
    (select id from public.accounts where owner_user_id=p_uid and type='expense' order by name limit 1)
  );
$$;

create or replace function public._fw_cash_account(p_uid uuid)
returns uuid language sql stable as $$
  select id from public.accounts where owner_user_id=p_uid and type='asset'
  order by (name <> 'Cash on Hand'), name limit 1;
$$;

-- 1) Add a piece expense as a ledger entry tagged to the piece.
create or replace function public.add_piece_expense(
  p_piece_id uuid, p_amount numeric, p_category text, p_note text default ''
) returns table(txn_id uuid, amount numeric, category text, note text, spent_on date)
language plpgsql as $$
declare
  v_uid uuid := auth.uid(); v_exp uuid; v_cash uuid; v_name text; v_txn uuid; v_owner uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero.'; end if;
  select owner_user_id into v_owner from public.inventory_pieces where id = p_piece_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your piece.'; end if;

  v_exp  := public._fw_expense_account(v_uid, p_category);
  v_cash := public._fw_cash_account(v_uid);
  if v_exp is null or v_cash is null then raise exception 'Set up your Books accounts first.'; end if;
  select name into v_name from public.accounts where id = v_exp;

  insert into public.transactions (owner_user_id, date, description, piece_id)
  values (v_uid, current_date, coalesce(nullif(p_note,''), v_name), p_piece_id)
  returning id into v_txn;
  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_exp, p_amount, 0), (v_uid, v_txn, v_cash, 0, p_amount);

  return query select v_txn, p_amount, v_name, coalesce(nullif(p_note,''), v_name), current_date;
end $$;

-- 2) Set (or replace) a piece's purchase price as one "Pieces Purchased" entry.
create or replace function public.set_piece_purchase(p_piece_id uuid, p_amount numeric)
returns void language plpgsql as $$
declare
  v_uid uuid := auth.uid(); v_exp uuid; v_cash uuid; v_txn uuid; v_owner uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select owner_user_id into v_owner from public.inventory_pieces where id = p_piece_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your piece.'; end if;

  delete from public.transactions
   where owner_user_id = v_uid and piece_id = p_piece_id
     and (memo = 'acq:' || p_piece_id or memo = 'mig:acq:' || p_piece_id);

  if p_amount is null or p_amount <= 0 then return; end if;

  v_exp  := public._fw_expense_account(v_uid, 'purchase');
  v_cash := public._fw_cash_account(v_uid);
  if v_exp is null or v_cash is null then raise exception 'Set up your Books accounts first.'; end if;

  insert into public.transactions (owner_user_id, date, description, memo, piece_id)
  values (v_uid, current_date, 'Bought piece', 'acq:' || p_piece_id, p_piece_id)
  returning id into v_txn;
  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_exp, p_amount, 0), (v_uid, v_txn, v_cash, 0, p_amount);
end $$;
