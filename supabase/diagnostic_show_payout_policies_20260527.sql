-- Show the full definition of every policy on payout_records.
-- The 'qual' column is the WHERE-style USING clause; 'with_check'
-- is the WITH CHECK clause for write policies.

select
  policyname,
  cmd                  as command,
  qual                 as using_clause,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename  = 'payout_records'
order by policyname;
