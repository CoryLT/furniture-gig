-- ============================================================
-- FLIPWORK-LEDGER-UPDATE-FN-V1  —  edit an entry safely  —  2026-06-17
-- ============================================================
-- Lets you change an entry's amount and/or its two accounts in ONE atomic,
-- balanced move: it rewrites both halves together so debits always equal
-- credits. Either the whole edit lands or none of it does.
--
-- Owner-checked: only works on your own entry, and only with your own
-- accounts. Built for the app to call as the logged-in operator.
-- Safe to re-run (create or replace).
-- ============================================================

create or replace function public.update_entry(
  p_id                uuid,
  p_date              date,
  p_amount            numeric,
  p_debit_account_id  uuid,
  p_credit_account_id uuid,
  p_description       text,
  p_memo              text default null,
  p_piece_id          uuid default null,
  p_contact_id        uuid default null
)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You must be signed in to edit an entry.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;
  if p_debit_account_id is null or p_credit_account_id is null then
    raise exception 'Both accounts are required.';
  end if;

  -- must be YOUR entry
  if not exists (
    select 1 from public.transactions where id = p_id and owner_user_id = v_uid
  ) then
    raise exception 'That entry is not yours to edit.';
  end if;

  -- both accounts must be YOURS (RLS makes this only see your accounts)
  if not exists (select 1 from public.accounts where id = p_debit_account_id) then
    raise exception 'Pick one of your own accounts.';
  end if;
  if not exists (select 1 from public.accounts where id = p_credit_account_id) then
    raise exception 'Pick one of your own accounts.';
  end if;

  update public.transactions
     set date        = p_date,
         description = p_description,
         memo        = nullif(p_memo, ''),
         piece_id    = p_piece_id,
         contact_id  = p_contact_id
   where id = p_id and owner_user_id = v_uid;

  -- both lines go in one statement (balanced at the end of the save)
  delete from public.entry_lines where transaction_id = p_id and owner_user_id = v_uid;

  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values
    (v_uid, p_id, p_debit_account_id,  p_amount, 0),
    (v_uid, p_id, p_credit_account_id, 0,        p_amount);
end;
$$;

-- ============================================================
-- End FLIPWORK-LEDGER-UPDATE-FN-V1
-- ============================================================
