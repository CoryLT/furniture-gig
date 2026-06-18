-- ============================================================
-- Worker pay tracking from the ledger — 2026-06-17
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- Run BEFORE deploying the matching app code.
-- ============================================================
-- In the operator-only world you pay workers off-platform and log it as a
-- Labor expense on a piece. This lets that expense remember WHICH worker it
-- was (a crew member), so Payment Records and the 1099 alert can be built
-- from your real labor logging instead of the shelved on-platform pay flow.
-- ============================================================

-- 1) Let a ledger transaction remember which crew member it paid.
alter table public.transactions
  add column if not exists crew_member_id uuid references public.crew_members(id) on delete set null;

create index if not exists transactions_crew_idx on public.transactions (crew_member_id);

-- 2) One row per worker payment, from the ledger (any expense tagged to a
--    crew member = a payment to that worker).
create or replace view public.worker_payments
with (security_invoker = true) as
select
  t.id            as txn_id,
  t.owner_user_id,
  t.crew_member_id,
  t.date,
  t.description,
  coalesce(sum(el.debit - el.credit), 0) as amount
from public.transactions t
join public.entry_lines el on el.transaction_id = t.id
join public.accounts a on a.id = el.account_id and a.type = 'expense'
where t.crew_member_id is not null
group by t.id, t.owner_user_id, t.crew_member_id, t.date, t.description;

-- 3) add_piece_expense now accepts an optional crew member to tag the payment.
create or replace function public.add_piece_expense(
  p_piece_id uuid, p_amount numeric, p_category text, p_note text default '',
  p_crew_member_id uuid default null
) returns table(txn_id uuid, amount numeric, category text, note text, spent_on date)
language plpgsql as $ape$
declare
  v_uid uuid := auth.uid(); v_exp uuid; v_cash uuid; v_name text; v_txn uuid; v_owner uuid; v_crew uuid;
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
  values (v_uid, current_date, coalesce(nullif(p_note,''), v_name), p_piece_id, v_crew)
  returning id into v_txn;
  insert into public.entry_lines (owner_user_id, transaction_id, account_id, debit, credit)
  values (v_uid, v_txn, v_exp, p_amount, 0), (v_uid, v_txn, v_cash, 0, p_amount);

  return query select v_txn, p_amount, v_name, coalesce(nullif(p_note,''), v_name), current_date;
end
$ape$;
