-- Find your user ID. Look for the row with your admin email
-- (the one in your NEXT_PUBLIC_ADMIN_EMAIL env var). Copy the
-- `id` value — we'll use it in the diagnostic.

select
  id,
  email,
  role,
  created_at
from public.users
order by created_at;
