-- ============================================================
-- FLIPWORK — record_piece_sale  —  2026-06-18
-- ============================================================
-- When you mark a piece Sold in the Pipeline, this logs that sale as
-- income in your Books ledger automatically — so it shows up in your
-- charts — without you picking accounts by hand.
--
-- It keeps exactly ONE sale entry per piece (memo 'sale:<pieceId>'):
-- editing the price or date updates that entry instead of adding another.
-- Passing 0 (or clearing the price) removes it.
--
-- Money in  -> debit your cash/bank account
-- Income    -> credit your "...Sales" income account (or your first income one)
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

create or replace function public.record_piece_sale(
  p_piece_id uuid, p_amount numeric, p_date date
) returns uuid
language plpgsql as $psale$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_title text; v_cash uuid; v_income uuid; v_txn uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;

  select owner_user_id, title into v_owner, v_title
    from public.inventory_pieces where id = p_piece_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your piece.'; end if;

  -- Keep it to one sale entry per piece: clear the old one first.
  delete from public.transactions
   where owner_user_id = v_uid and piece_id = p_piece_id and memo = 'sale:' || p_piece_id;

  -- No / non-positive amount just clears the sale.
  if p_amount is null or p_amount <= 0 then return null; end if;

  v_cash := public._fw_cash_account(v_uid);
  select coalesce(
    (select id from public.accounts
       where owner_user_id = v_uid and type = 'income' and name ilike '%sale%'
       order by name limit 1),
    (select id from public.accounts
       where owner_user_id = v_uid and type = 'income'
       order by name limit 1)
  ) into v_income;
  if v_cash is null or v_income is null then
    raise exception 'Set up your Books accounts first.';
  end if;

  insert into public.transactions (owner_user_id, date, description, memo, piece_id)
  values (
    v_uid, coalesce(p_date, current_date),
    'Sold: ' || coalesce(nullif(v_title, ''), 'piece'),
    'sale:' || p_piece_id, p_piece_id
  )
  returning id into v_txn;

  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_cash, p_amount, 0),
         (v_uid, v_txn, v_income, 0, p_amount);

  return v_txn;
end
$psale$;

-- ============================================================
-- End — record_piece_sale
-- ============================================================
