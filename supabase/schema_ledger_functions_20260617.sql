-- ============================================================
-- FLIPWORK-LEDGER-FNS-V1  —  record money in / money out  —  2026-06-17
-- ============================================================
-- Step 3. Two helper functions that write a money event into the ledger
-- as ONE balanced double-entry transaction (two halves that always match).
-- Built on the tables from schema_ledger_20260617.sql.
--
-- These are meant to be called BY THE APP as the logged-in operator. They
-- stamp every row with that operator (auth.uid()) so the privacy fence is
-- never broken, and they refuse anything that isn't yours.
--
-- NOTE: you can't really test these by hand in the SQL Editor, because the
-- editor isn't "signed in" as you (auth.uid() is empty there). The test for
-- THIS file is simply that it runs with no error (the functions get created).
-- We'll see them actually work once we build the first Books screen.
--
-- Safe to re-run. Idempotent (create or replace).
-- ============================================================

-- ---------- record_expense: money OUT ----------
-- Two balanced halves:
--   1. the cost  -> debit an expense account (e.g. "Materials & Supplies")
--   2. money out -> credit the account you paid from (e.g. "Cash on Hand")
-- Tag a piece to make it count toward that piece's cost. Returns the new id.
create or replace function public.record_expense(
  p_date                 date,
  p_amount               numeric,
  p_expense_account_id   uuid,
  p_paid_from_account_id uuid,
  p_description          text,
  p_memo                 text default null,
  p_piece_id             uuid default null,
  p_contact_id           uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_uid    uuid := auth.uid();
  v_txn_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to record an expense.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero.';
  end if;

  if p_expense_account_id is null or p_paid_from_account_id is null then
    raise exception 'Both a category and a "paid from" account are required.';
  end if;

  -- both accounts must be YOURS (RLS makes this select only see your accounts)
  if not exists (select 1 from public.accounts where id = p_expense_account_id) then
    raise exception 'That expense category is not one of your accounts.';
  end if;
  if not exists (select 1 from public.accounts where id = p_paid_from_account_id) then
    raise exception 'That "paid from" account is not one of your accounts.';
  end if;

  insert into public.transactions (owner_user_id, date, description, memo, piece_id, contact_id)
  values (v_uid, p_date, p_description, nullif(p_memo, ''), p_piece_id, p_contact_id)
  returning id into v_txn_id;

  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values
    (v_uid, v_txn_id, p_expense_account_id,   p_amount, 0),
    (v_uid, v_txn_id, p_paid_from_account_id, 0,        p_amount);

  return v_txn_id;
end;
$$;


-- ---------- record_cash_sale: money IN ----------
-- Two balanced halves:
--   1. money in -> debit an asset account  (e.g. "Cash on Hand")
--   2. income   -> credit an income account (e.g. "Furniture Sales")
-- Tag a piece to credit the sale to that flip. Returns the new id.
create or replace function public.record_cash_sale(
  p_date              date,
  p_amount            numeric,
  p_asset_account_id  uuid,
  p_income_account_id uuid,
  p_description       text,
  p_memo              text default null,
  p_piece_id          uuid default null,
  p_contact_id        uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_uid    uuid := auth.uid();
  v_txn_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in to record a sale.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Sale amount must be greater than zero.';
  end if;

  if p_asset_account_id is null or p_income_account_id is null then
    raise exception 'Both an asset account and an income account are required.';
  end if;

  if not exists (select 1 from public.accounts where id = p_asset_account_id) then
    raise exception 'That deposit account is not one of your accounts.';
  end if;
  if not exists (select 1 from public.accounts where id = p_income_account_id) then
    raise exception 'That income account is not one of your accounts.';
  end if;

  insert into public.transactions (owner_user_id, date, description, memo, piece_id, contact_id)
  values (v_uid, p_date, p_description, nullif(p_memo, ''), p_piece_id, p_contact_id)
  returning id into v_txn_id;

  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values
    (v_uid, v_txn_id, p_asset_account_id,  p_amount, 0),
    (v_uid, v_txn_id, p_income_account_id, 0,        p_amount);

  return v_txn_id;
end;
$$;

-- ============================================================
-- End FLIPWORK-LEDGER-FNS-V1
-- ============================================================
