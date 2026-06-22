-- ============================================================
-- FLIPWORK — record_transfer  —  2026-06-20
-- ============================================================
-- Moves money between two of YOUR buckets as one balanced entry — e.g.
-- depositing Cash on Hand into Bank / Checking. Debits the "to" bucket
-- (money in) and credits the "from" bucket (money out). No income/expense
-- is created — it's just money changing location.
--
-- Run in the MARKETPLACE project ("FlipWork Web App"), Primary db.
-- Safe to re-run.
-- ============================================================

create or replace function public.record_transfer(
  p_date date,
  p_amount numeric,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_note text default null
) returns uuid language plpgsql as $xfer$
declare
  v_uid uuid := auth.uid();
  v_txn uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero.'; end if;
  if p_from_account_id is null or p_to_account_id is null then raise exception 'Pick both buckets.'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'Pick two different buckets.'; end if;
  if not exists (select 1 from public.accounts where id = p_from_account_id and owner_user_id = v_uid)
    then raise exception 'That "from" bucket is not yours.'; end if;
  if not exists (select 1 from public.accounts where id = p_to_account_id and owner_user_id = v_uid)
    then raise exception 'That "to" bucket is not yours.'; end if;

  insert into public.transactions (owner_user_id, date, description, memo)
  values (v_uid, coalesce(p_date, current_date), coalesce(nullif(p_note, ''), 'Moved money'), 'transfer')
  returning id into v_txn;

  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, p_to_account_id, p_amount, 0),
         (v_uid, v_txn, p_from_account_id, 0, p_amount);

  return v_txn;
end
$xfer$;

-- ============================================================
-- End — record_transfer
-- ============================================================
