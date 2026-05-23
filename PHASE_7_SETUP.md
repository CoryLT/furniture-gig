# Phase 7 — Stripe Webhooks Setup

This is the setup you (Cory) need to do after pulling this commit. There are **three steps**: paste SQL into Supabase, register a webhook in Stripe, paste one secret into Vercel.

Total time: about 5 minutes.

---

## What just got built

A new URL on your site: **`/api/stripe/webhook`**

That URL listens for messages from Stripe. When something happens — money captured, transfer to a worker succeeded, a card got disputed — Stripe pings that URL, and your app updates the database.

Until this is set up, Stripe has nothing to talk to. After it's set up, your payments system is much closer to "ready for real money."

---

## Step 1 — Paste SQL into Supabase

This adds a new table called `stripe_webhook_events` that logs every message Stripe sends us. It's how we avoid double-processing the same event if Stripe sends it twice (which happens sometimes).

1. Open Supabase → your project → **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `supabase/schema_phase7_stripe_webhooks.sql` from this repo
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** (bottom right)

You should see a green "Success" message. That's it for Supabase.

---

## Step 2 — Register the webhook in Stripe

This tells Stripe where to send the messages.

1. Open your Stripe dashboard: https://dashboard.stripe.com
2. **IMPORTANT:** Make sure you're in **Test mode** (toggle in the top right). We're not on live yet.
3. Left sidebar → **Developers** → **Webhooks**
4. Click **Add endpoint** (top right)
5. In **Endpoint URL**, paste: `https://myflipwork.com/api/stripe/webhook`
6. **Description** (optional): "FlipWork main webhook"
7. **Events to send** — click **Select events**, then check these 8 boxes:
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `transfer.created`
   - `transfer.failed`
   - `charge.refunded`
   - `charge.dispute.created`
8. Click **Add events**
9. Click **Add endpoint**

You should now see a page for the new endpoint.

### Get the signing secret

10. On that endpoint page, look for **Signing secret** → click **Reveal**
11. Copy the value. It starts with `whsec_...`

Keep that copied — you need it for the next step.

---

## Step 3 — Paste the secret into Vercel

1. Open Vercel: https://vercel.com/dashboard
2. Click your project (**furniture-gig**)
3. Top → **Settings** → **Environment Variables** (left sidebar)
4. Click **Add New**
5. **Key:** `STRIPE_WEBHOOK_SECRET`
6. **Value:** paste the `whsec_...` thing you copied from Stripe
7. **Environments:** check all three (Production, Preview, Development)
8. Click **Save**

### Redeploy so Vercel picks up the new env var

9. Top → **Deployments** tab
10. On the latest deploy, click the **⋯** menu → **Redeploy**
11. Uncheck "Use existing Build Cache"
12. Click **Redeploy**
13. Wait for it to finish (~1–2 min)

---

## Step 4 — Test it

The easiest way to confirm everything's wired up:

1. Back in Stripe → **Developers** → **Webhooks** → your endpoint
2. Click **Send test webhook** (top right, or near the events list)
3. Pick `account.updated` → click **Send test event**

Then in Supabase:

1. Go to **Table editor** → `stripe_webhook_events`
2. You should see one row with:
   - `type` = `account.updated`
   - `status` = `processed` or `ignored` (either is fine for a fake test event)
   - `received_at` = right around now

If you see a row, **it works**. ✅

If you don't see a row, in Stripe's webhook view, click the failed delivery → look at the response. If it says "Signature verification failed," the secret in Vercel doesn't match the one in Stripe — repeat Step 3.

---

## What changes for your day-to-day workflow

**Nothing.** Webhooks happen in the background. You won't see anything different in the app yet. The next phase (Phase 6 admin payout UI upgrade) will surface Stripe payment statuses on the admin payouts page — _that's_ where you'll see the difference.

What this DID change behind the scenes:

- If money is captured from a flipper and your database write fails for any reason, the webhook now catches it and reconciles the row.
- If a transfer to a worker fails (bank rejection, account restricted), `payout_records.notes` now gets a clear note instead of silently sitting in "captured."
- If a flipper disputes a charge, a ⚠️ note gets attached to that payout row.
- All eight event types are logged in `stripe_webhook_events` so you have an audit trail.

---

## When you go live (Phase 9)

You'll need to **redo Step 2 and Step 3 in live mode** — webhooks are scoped to test or live, not both. Make a separate endpoint in Stripe (this time with the toggle on Live), get a new `whsec_...`, paste that one into Vercel.

For now, test mode is correct.

---

## If something goes wrong later

- **All webhook events are stored in `stripe_webhook_events`** with their full Stripe payload as JSON. Open that table in Supabase and you can see exactly what came in.
- **`status = 'error'`** rows have the error message in `error_message`.
- **Stripe's dashboard** also shows every delivery attempt, the response we sent back, and lets you manually replay an event.
