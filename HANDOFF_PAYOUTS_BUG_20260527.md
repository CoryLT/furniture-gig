# Handoff: $0 vs $40.18 Payouts Mismatch
## 2026-05-27

## The bug Cory is hitting

When logged in as **`corythacker@gmail.com`** (user ID `72f34512-113f-4c02-b638-0ddf3236d2a9`):

- **`/flipper/dashboard`** "Paid Out" tile shows **$40.18** ✅
- **`/flipper/payouts`** page (linked from the tile) shows **$0** ❌

Both pages should show the same number. The dashboard tile uses an explicit `.in('gig_id', myGigIds)` filter and finds the data. The `/flipper/payouts` page relies purely on RLS and finds nothing.

## Ground truth (confirmed via Supabase SQL Editor)

There are exactly 2 paid rows in `payout_records` for this user's gigs:

| Gig title | Gig status | pay_amount | payout_status | stripe_payment_status | payout_amount | poster_user_id | created_by |
|---|---|---|---|---|---|---|---|
| Quick Flip! Chest of Drawers | **archived** | $1.00 | paid | captured | $0.98 | gmail | gmail |
| Quick Gig! Light sand/paint | completed | $40.00 | paid | captured | $39.20 | gmail | gmail |

Net total = **$40.18**. This is also confirmed against Stripe live mode (Transactions tab shows 2 succeeded captures + 2 uncaptured holds — the holds are correctly held against active claims and not relevant).

## Two suspect causes

### Cause 1: `gigs` RLS hiding the archived gig
The gigs table has this policy:
```sql
create policy "Workers can view open/claimed/in_review gigs"
  on public.gigs for select
  using (
    auth.uid() is not null
    and status in ('open', 'claimed', 'in_review', 'completed')
  );
```
Archived gigs are invisible to non-admins. The RLS policy I added on `payout_records` (`schema_payout_records_flipper_read_20260527.sql`) does an `exists (... from gigs where ...)` subquery — which is gated by the gigs RLS. So the archived $0.98 payout is invisible.

But this doesn't explain why the **completed** $39.20 payout is also invisible.

### Cause 2: Multiple OR'd RLS policies, some failing silently
A previous Claude session added these policies (not in any SQL file in the repo — added via Supabase UI):
- `Flippers can view their own payout records` (SELECT) — likely `auth.uid() = flipper_user_id`
- `Flippers can insert their own payout records` (INSERT) — `auth.uid() = flipper_user_id`
- `Flippers can update their own payout records` (UPDATE) — `auth.uid() = flipper_user_id`

If `flipper_user_id` is NULL on the existing paid rows (because they predate the Stripe Connect column), this policy doesn't help — but that's fine, RLS is OR'd.

The bigger question: **why is even the completed gig's payout invisible?** Both policies should let it through. We need to see the actual `using_clause` definitions.

## What's queued up but unanswered

A diagnostic SQL is sitting in the repo waiting to be run:
- `supabase/diagnostic_show_payout_policies_20260527.sql` — shows full RLS policy text for `payout_records`

Cory hasn't run this one yet. Running it would reveal whether:
- The "Flippers can view" policy filters on `flipper_user_id` (if so, the column is likely null on those rows)
- Whether there are conflicting/blocking policies we don't know about

## Recommended next steps for fresh session

1. **Run the diagnostic SQL** above. Get the screenshot. That tells us the exact `using` clauses.
2. **Verify `flipper_user_id` on the paid rows.** Run:
   ```sql
   select id, gig_id, worker_user_id, flipper_user_id, payout_status, amount
   from public.payout_records
   where payout_status = 'paid';
   ```
3. **Pick the right fix based on what's found:**
   - If `flipper_user_id` is null on those rows: backfill it.
   - If the issue is the gigs RLS blocking archived gigs: rewrite the `Gig posters can view payouts on their gigs` policy to NOT rely on a subquery to gigs, or to use a security-definer function that bypasses gigs RLS.
   - Most likely fix: both.

## Cory's user IDs (for SQL Editor where `auth.uid()` is null)
- `corythacker@proton.me` (admin): `ae847095-eaeb-4522-8cb3-001553933bf1`
- `corythacker@gmail.com` (flipper for these gigs): `72f34512-113f-4c02-b638-0ddf3236d2a9`

## Other recent work in this session (already deployed, working)

These shipped fine and don't need follow-up:
1. Removed PayPal email requirement from `/auth/onboarding` and `/profile` (commit `56c9cfc`)
2. Replaced PayPal wording with Stripe across user-facing UI (commit `ccce95c`)
3. Added RLS policy so gig posters can view worker proof photos (commit `fd0638f`, requires `schema_gig_photo_uploads_flipper_read_20260527.sql` — already ran)
4. Made flipper dashboard hero tiles clickable filter buttons (commit `23a23fd`)
5. Fixed flipper dashboard hero stats: Active count, "Gigs with applicants" label, Paid Out source (commit `d243485`)
6. Built `/flipper/payouts` page and pointed dashboard tile there; fixed admin payouts inner join bug (commit `abbc76b`) — **this is where the current bug lives**
7. Several diagnostic SQL files in `supabase/diagnostic_*.sql` (no schema changes, just READ queries)

## Email notifications work (paused)

Was building Phase 2: new message email notifications with 10-minute cooldown. Resend pipeline verified working via `/api/email/test`. Phase 1 infrastructure (lib/email.ts, email_log table, preferences) already in place. Not started yet — was about to dig into where messages get sent when this bug interrupted.
