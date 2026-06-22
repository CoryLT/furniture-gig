-- ============================================================
-- FLIPWORK — add_piece_expense: allow a custom date  —  2026-06-22
-- ============================================================
-- Logging a fix-up cost (materials, labor, etc.) on a PAST sale needs that
-- expense to land in the month the sale happened, not today. This adds an
-- optional date to add_piece_expense, the same way set_piece_purchase got one.
--
-- Existing calls keep working: the date just defaults to today when not given,
-- so the Pipeline "Add expense" box needs no change.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

-- Drop the older versions so the new default-date version is the only one and
-- there's no ambiguity. Old calls (with or without a crew member) still resolve
-- to the new function because the extra arguments have defaults.
drop function if exists public.add_piece_expense(uuid, numeric, text, text);
drop function if exists public.add_piece_expense(uuid, numeric, text, text, uuid);

create or replace function public.add_piece_expense(
  p_piece_id uuid, p_amount numeric, p_category text, p_note text default '',
  p_crew_member_id uuid default null, p_date date default null
) returns table(txn_id uuid, amount numeric, category text, note text, spent_on date)
language plpgsql as $aped$
declare
  v_uid uuid := auth.uid(); v_exp uuid; v_cash uuid; v_name text; v_txn uuid; v_owner uuid; v_crew uuid;
  v_when date := coalesce(p_date, current_date);
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero.'; end if;
  select owner_user_id into v_owner from public.inventory_pieces where id = p_piece_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your piece.'; end if;

  -- only accept a crew member that belongs to this operator
  if p_crew_member_id is not null then
    select id into v_crew from public.crew_members where id = p_crew_member_id and operator_user_id = v_uid;
  end if;

  v_exp  := public._fw_expense_account(v_uid, p_category);
  v_cash := public._fw_cash_account(v_uid);
  if v_exp is null or v_cash is null then raise exception 'Set up your Books accounts first.'; end if;
  select name into v_name from public.accounts where id = v_exp;

  insert into public.transactions (owner_user_id, date, description, piece_id, crew_member_id)
  values (v_uid, v_when, coalesce(nullif(p_note,''), v_name), p_piece_id, v_crew)
  returning id into v_txn;
  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_exp, p_amount, 0), (v_uid, v_txn, v_cash, 0, p_amount);

  return query select v_txn, p_amount, v_name, coalesce(nullif(p_note,''), v_name), v_when;
end
$aped$;

-- ============================================================
-- End — add_piece_expense custom date
-- ============================================================
