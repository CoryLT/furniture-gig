-- ============================================================
-- FLIPWORK — add_labor_payment: log a labor payment to a person  —  2026-06-22
-- ============================================================
-- Adds ONE labor expense to your books, tagged to a crew member, so it shows in
-- their payment history and counts toward their 1099. A piece is OPTIONAL — use
-- it for "I paid Nick $50" whether or not it's tied to a specific flip.
--
-- It's like add_piece_expense, but the category is always Labor and the piece
-- can be left blank.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db. Safe to re-run.
-- ============================================================

create or replace function public.add_labor_payment(
  p_amount numeric,
  p_crew_member_id uuid,
  p_date date default null,
  p_note text default '',
  p_piece_id uuid default null
) returns table(txn_id uuid, amount numeric, note text, spent_on date)
language plpgsql as $alp$
declare
  v_uid uuid := auth.uid();
  v_exp uuid; v_cash uuid; v_name text; v_txn uuid; v_crew uuid; v_owner uuid;
  v_when date := coalesce(p_date, current_date);
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero.'; end if;

  -- The crew member must belong to this operator.
  select id into v_crew from public.crew_members
   where id = p_crew_member_id and operator_user_id = v_uid;
  if v_crew is null then raise exception 'Pick one of your own crew.'; end if;

  -- If a piece is given, it must be yours.
  if p_piece_id is not null then
    select owner_user_id into v_owner from public.inventory_pieces where id = p_piece_id;
    if v_owner is null or v_owner <> v_uid then raise exception 'Not your piece.'; end if;
  end if;

  v_exp  := public._fw_expense_account(v_uid, 'labor');
  v_cash := public._fw_cash_account(v_uid);
  if v_exp is null or v_cash is null then raise exception 'Set up your Books accounts first.'; end if;
  select name into v_name from public.accounts where id = v_exp;

  insert into public.transactions (owner_user_id, date, description, piece_id, crew_member_id)
  values (v_uid, v_when, coalesce(nullif(p_note,''), v_name), p_piece_id, v_crew)
  returning id into v_txn;
  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_exp, p_amount, 0), (v_uid, v_txn, v_cash, 0, p_amount);

  return query select v_txn, p_amount, coalesce(nullif(p_note,''), v_name), v_when;
end
$alp$;

-- ============================================================
-- End — add_labor_payment
-- ============================================================
