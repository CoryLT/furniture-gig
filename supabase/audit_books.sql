-- ============================================================
-- FLIPWORK — books audit (READ-ONLY, changes nothing)
-- Run in FlipWork Web App SQL Editor. Run each query on its own.
-- ============================================================

-- QUERY A — Trial balance + integrity check.
-- Every account with its total debits and credits. The bottom TOTAL row is the
-- proof: in honest double-entry books, total debits MUST equal total credits.
select a.type, a.name,
       round(sum(el.debit), 2)  as debits,
       round(sum(el.credit), 2) as credits
from public.accounts a
join public.entry_lines el on el.account_id = a.id
join auth.users u on u.id = a.owner_user_id
where lower(u.email) = lower('corythacker@gmail.com')
group by a.type, a.name
union all
select 'zzz-TOTAL', '(debits must equal credits)',
       round(sum(el.debit), 2), round(sum(el.credit), 2)
from public.entry_lines el
join auth.users u on u.id = el.owner_user_id
where lower(u.email) = lower('corythacker@gmail.com')
order by 1, 2;


-- QUERY B — Owner money, traced to where each chunk came from.
-- Ties every dollar of "put in" / "took out" to its source so you can check it
-- against the matching statement (wf = Wells Fargo, relay = Relay, personal =
-- your personal-card supplies, sale = a sale you logged in the app).
select a.name as bucket,
       coalesce(nullif(split_part(t.memo, ':', 1), ''), '(logged in app / manual)') as source,
       round(sum(case when a.name = 'Owner''s Draws'
                      then el.debit - el.credit
                      else el.credit - el.debit end), 2) as amount,
       count(*) as lines
from public.entry_lines el
join public.accounts a on a.id = el.account_id
join public.transactions t on t.id = el.transaction_id
join auth.users u on u.id = el.owner_user_id
where lower(u.email) = lower('corythacker@gmail.com')
  and a.name in ('Owner''s Draws', 'Owner''s Contributions')
group by a.name, source
order by a.name, amount desc;
