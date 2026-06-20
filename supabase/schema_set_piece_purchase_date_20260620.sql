-- ============================================================
-- FLIPWORK — set_piece_purchase: allow a custom date  —  2026-06-20
-- ============================================================
-- Backfilling past sales needs the COST (purchase) entry to land in the
-- right month, not today. This adds an optional date to set_piece_purchase.
-- Existing 2-argument calls keep working (the date just defaults to today),
-- so nothing else needs to change.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

-- Drop the old 2-arg version so the new default-date version takes over for
-- every caller (old calls with 2 args still resolve to it).
drop function if exists public.set_piece_purchase(uuid, numeric);

create or replace function public.set_piece_purchase(
  p_piece_id uuid, p_amount numeric, p_date date default null
) returns void language plpgsql as $spp2$
declare
  v_uid uuid := auth.uid(); v_exp uuid; v_cash uuid; v_txn uuid; v_owner uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select owner_user_id into v_owner from public.inventory_pieces where id = p_piece_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Not your piece.'; end if;

  -- Keep it to one purchase entry per piece: clear the old one first.
  delete from public.transactions
   where owner_user_id = v_uid and piece_id = p_piece_id
     and (memo = 'acq:' || p_piece_id or memo = 'mig:acq:' || p_piece_id);

  if p_amount is null or p_amount <= 0 then return; end if;

  v_exp  := public._fw_expense_account(v_uid, 'purchase');
  v_cash := public._fw_cash_account(v_uid);
  if v_exp is null or v_cash is null then raise exception 'Set up your Books accounts first.'; end if;

  insert into public.transactions (owner_user_id, date, description, memo, piece_id)
  values (v_uid, coalesce(p_date, current_date), 'Bought piece', 'acq:' || p_piece_id, p_piece_id)
  returning id into v_txn;
  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_exp, p_amount, 0), (v_uid, v_txn, v_cash, 0, p_amount);
end
$spp2$;

-- ============================================================
-- End — set_piece_purchase custom date
-- ============================================================
