# FlipWork — Handoff

> Compressed May 28, 2026. Full history lives in `git log`; this doc keeps only
> what's true *now* plus the gotchas that save the next session real time.

---

## Project basics

- **App:** FlipWork — a two-sided platform for the flipping economy. People post gigs, claim gigs, sell items on a marketplace, and (new) advertise services they offer. Furniture was the origin; it's now "anything that can legally be flipped."
- **Repo:** `github.com/CoryLT/furniture-gig` (code name stayed `furniture-gig`; brand is FlipWork).
- **Stack:** Next.js 14.1 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind 3.3 · Resend (email) · Sightengine (image moderation) · Anthropic (AI support). Deployed on Vercel.
- **Domain:** myflipwork.com (live). **Payments are now direct & off-platform — Stripe removed. See Payments below.**
- **Operating entity:** Groovy Greens, LLC (NC) d/b/a FlipWork. NC governing law, binding arbitration + class waiver in TOS.

---

## How Cory works (NON-NEGOTIABLE)

1. **You do all the coding.** Cory does NOT copy/paste code. Clone/edit in your sandbox, commit, push.
2. **One file at a time. Test. Commit. Move on.** No batching.
3. **8th grade language. No jargon.** Walk through changes in plain English.
4. **Ask before doing only if there's a real fork.** Use `ask_user_input_v0` with 2-3 options. Don't ask when there's one sensible path. Cory will often say "use your judgement" — take it.
5. **He sends screenshots when stuck.** If something "kinda" worked, ask for the URL/screenshot before guessing.
6. **SQL is the ONE copy/paste exception.** Keep SQL files in `supabase/`, give crystal-clear "open raw → copy → Supabase SQL Editor → Run" instructions.
7. **GitHub raw pages cache hard.** If a re-pushed SQL/file looks stale to Cory, send the `/raw/` URL and tell him to hard-refresh (Ctrl/Cmd+Shift+R).

---

## How to push from your sandbox

You need a fresh GitHub token from Cory each session (they expire / he revokes after each session — that IS the security model; don't suggest storing it anywhere). Push via the GitHub Contents API (base64 PUT) or:
```
git push https://CoryLT:<TOKEN>@github.com/CoryLT/furniture-gig.git main
```
After you push, Cory runs in VS Code: `git pull` → `git push` → waits ~45-60s for Vercel. **Vercel does NOT auto-deploy from your API pushes — Cory's local `git push` is what triggers it.**

**Push gotcha (cost real time before):** when editing a file via the Contents API, capture the base64 of the FINAL edited file immediately before the PUT. Twice this session a push reported "OK" but shipped a stale version because the local file got overwritten between edit and encode. After any push of a critical file, read it back from `raw.githubusercontent.com` and grep for a marker string to confirm.

---

## Current state (what's working)

**Identity & profiles**
- Unified login — anyone can post OR claim gigs OR sell OR offer services.
- Profile editor at `/profile` → `/api/profile/unified-save` (writes `worker_profiles` + `flipper_profiles`).
- Worker profile editor at `/profile/worker`. Public profile at `/u/[username]` pulls from both tables: hero card + discovery sections (Available gigs, **Services offered** [new], Listings for sale, Work Samples). Empty sections hide from strangers; owner sees a CTA.
- `worker_profiles` uses a single **`full_name`** column (NOT first_name/last_name — old schema had those; several helpers still wrongly selected first/last and were fixed this session. If you see first_name/last_name anywhere, it's a bug).
- A profile with **no username** has no public page — it's filtered out of search and renders unlinked elsewhere.

**Gigs & marketplace**
- Post/edit/browse gigs (city/state filter; own posts shown with "Your post" badge). Draft flow: step 1 saves `draft`, "Finish & post" flips to `open`.
- Application/approval flow (flipper picks an applicant; replaced first-to-claim).
- Marketplace at `/marketplace`: post/edit/sell/hide items. Public feed.
- **Landing/front door:** `/` is the public landing (`app/page.tsx`, founder note + photo). Logged-in post-auth landing and logo destination is `/home`. `/home` is a protected route (middleware redirects logged-out → `/auth/login`).

**Payments (DIRECT PAY — Stripe REMOVED, May 31 pivot)**
- **No processor, no fee, no holds.** FlipWork never touches gig money. The poster pays the worker **directly** on whatever app the worker already uses (Cash App, Venmo, PayPal, Zelle, or cash). The old 2%-per-gig fee is gone.
- **Why:** Stripe forced workers through heavy onboarding (bank + ID) — a wall for low-tech, Cash-App-only workers (the 64-yo with the busted Android couldn't onboard). Free + direct kills that wall.
- **The live flow:**
  1. Worker saves their pay handle on `/profile` ("How you get paid" — `components/profile/PayoutHandlesSection.tsx`).
  2. Worker applies — no Stripe wall.
  3. Poster picks the worker — no card, no hold (pick route gutted to just the `approve_applicant` RPC).
  4. Worker does checklist + photos → "Submit for review."
  5. Poster **approves the work** (no charge) at `/flipper/review/[claimId]` → a **"Pay [worker]" card** (`components/shared/PayWorkerCard.tsx`) shows the handle + amount + "Mark as paid" (Cash App/Venmo/PayPal/Zelle/Cash).
  6. Worker taps **"Did you get paid?"** (`components/shared/ConfirmReceivedCard.tsx`) → confirms → both sides show "Paid & confirmed."
- **New tables:** `worker_payout_handles` (worker's pay-app handles; RLS-gated so only a booked poster can read them) and `gig_payments` (one row per gig: `marked_paid_at` + `worker_confirmed_at` = the two-sided handshake). SQL: `schema_worker_payout_handles_20260530.sql`, `schema_gig_payments_20260530.sql` (both run).
- **Stripe is NOT yet removed from the codebase** — lots of dormant Stripe code remains. See the "Stripe / PayPal removal" section. One live landmine: the **admin** review path (`app/admin/review/[claimId]/ReviewActions.tsx`) still calls the dead `capture-payment` route.

**Other shipped**
- AI support chat at `/support` (Haiku 4.5; reads user's own gigs/payouts/Stripe; escalates; admin queue at `/admin/support`).
- TOS + Privacy v1.0 live, public at `/legal/terms` + `/legal/privacy`; unaccepted-required gate redirects to `/auth/agreements`.
- Image moderation (Sightengine) on all 6 upload paths. HEIC→JPEG in-browser via `lib/imageCompression.ts`.
- Founding member system (first 25 workers + 25 flippers auto-flagged; badge + live counter).
- Admin `/admin` is analytics-only; gig posting/editing is all user-side now.
- Email pipeline (Resend) via `lib/email.ts` — see Messaging/email below.
- ShareButton, BackToTopButton, "More gigs from this poster" carousel, "You're early" empty states.

---

## Messaging system (THREE kinds now)

Inbox at `/messages` unions all three. Thread page `/messages/[conversationId]` looks the ID up in each table and dispatches. `ChatClient.tsx` is shared; it maps `conversationKind` → the right messages table.

1. **Gig** — `gig_conversations` / `gig_messages` (flipper ↔ worker on a gig).
2. **Listing** — `listing_conversations` / `listing_messages` (buyer ↔ seller).
3. **User-to-user** (NEW this session) — `user_conversations` / `user_messages`. Any logged-in user ↔ any other. Started by the "Contact Me" button on a public profile (`components/shared/ContactButton.tsx` → `/api/user-messages/start`). Conversation pair is stored canonically (`user_a_id < user_b_id`, enforced by a CHECK + unique constraint); the start route orders the two IDs before insert.

**Inbox features (NEW):**
- Inbox / Archived tabs (`?view=archived`).
- Per-row ⋮ menu (`ConversationRow.tsx`): Archive / Move-to-inbox / Delete. Backed by `conversation_user_state` (per-user, per-conversation; `archived_at` / `deleted_at`). Delete is a per-user hide, never destroys the other side's copy; a deleted thread reappears if a newer message arrives. Menu flips upward when near the bottom of the viewport.
- Empty conversations (created on Contact-click but no message sent) are filtered out of the inbox.

**Safeguards (NEW):**
- Block / report from the chat header (`ChatSafetyMenu.tsx`). Block → `/api/users/block` writes `user_blocks`; RLS on `user_conversations`/`user_messages` blocks sending in either direction once blocked. Report → `/api/messages/report` writes `message_reports` (references the latest message in the thread). **No admin UI to review reports yet — known gap, see What's next.** Per Cory's call there is deliberately NO new-user conversation rate limit.

**Email on new message (NEW):**
- `ChatClient` fires `/api/messages/notify` (fire-and-forget) after a successful send. Route resolves the other participant, checks `notification_preferences.email_messages`, dedups, and sends via `lib/email.ts` (`eventType: 'new_message'`, already defined). **Throttle:** idempotency key buckets by hour (`new_message:<convId>:<recipientId>:<YYYY-MM-DDTHH>`) → at most one email per conversation per recipient per hour.
- `lib/email.ts` checks prefs + `email_log` idempotency, sends via Resend, logs every attempt. FROM is hardcoded `notifications@myflipwork.com`. **TODO/cleanup:** the notify route hardcodes `https://myflipwork.com`; there's a `getSiteUrl()` helper in `lib/utils.ts` (`NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → fallback) that should be used instead.

---

## Services offered (NEW this session — supply-side expansion)

Workers advertise up to 10 services on their public profile.

- **Tables:** `service_categories` (admin-editable, public-read; seeded then trimmed to **59** flipping-economy categories — physical-human-labor only, no generic homeowner services, no AI-doable laptop work, "Delivery" included). `worker_services` (worker_user_id, category_id, blurb ≤300 chars, price_type [`flat`/`hourly`/`starting_at`/`contact_for_quote`], price_amount, sort_order, active). Max-10 enforced by a BEFORE INSERT trigger; unique (worker, category); location inherits from the worker's profile (no per-service location).
- **SQL files (all run):** `schema_service_categories_20260527.sql`, `schema_worker_services_20260527.sql`, `cleanup_service_categories_20260527.sql`.
- **Manage page:** `/profile/worker/services` (add/edit/delete, "N of 10 used"). Linked from the worker profile card AND the hamburger nav ("Services I Offer").
- **Display:** "Services offered" section on `/u/[username]` (`PublicProfileClient.tsx`), shown to everyone, with a "Contact Me" button in the hero.

---

## Search (NEW this session)

- Header search (`components/shared/HeaderSearch.tsx`) in `Nav.tsx` — desktop inline bar, mobile expand-icon. Submits to `/search?q=...`.
- Results page `app/search/page.tsx` (server component) — groups into **People / Services / Listings / Gigs**.
  - People: `worker_profiles` name+username, public + **username required** (usernameless filtered out).
  - Services: matches category label OR blurb; worker must be public + have a username.
  - **Listings & Gigs: TITLE ONLY.** (Was title+description/summary — descriptions are noisy with "delivery/pickup/cash" etc., so a service-name search dumped unrelated items. Title-only is the deliberate fix.)
  - Min 2 chars. `ilike` partial, case-insensitive. Active listings / open gigs only.
  - Logged-out users can search + see results, with a login/signup banner; they can't act.
- On-page bar (`SearchPageBar.tsx`) prefilled with the query + Cancel. **Cancel routes to `/home` (logged in) or `/` (logged out)** — NOT `router.back()`, which used to climb back through stacked search history.

---

## Watch out for (load-bearing gotchas)

- **`worker_profiles.full_name`** is the name column. Selecting `first_name`/`last_name` returns nothing and silently shows "User". Fixed in `fetchOtherUser` (thread page) and the inbox this session; check anywhere else that displays a name.
- **`users` table RLS** only lets a user read their OWN row (or all if admin). Do NOT add an "existence check" against `users` for another user — it'll false-fail. (Bit the user-messages start route; removed. FK constraints enforce real IDs anyway.)
- **SQL ordering:** if a policy references another table (e.g. `user_conversations` policy references `user_blocks`), create the referenced table FIRST in the file. (Cost a re-push this session.)
- **`/home` is protected** — never send logged-out users there. Public landing is `/`.
- **MIME type can be empty** on iPhone HEIC uploads before conversion — use `looksLikeHeic()` / `isAcceptableImageFile()` in `lib/imageCompression.ts`, don't trust `file.type`.
- **Vercel deploy** only fires on Cory's local `git push`, not your API pushes.
- **Resend** must have `RESEND_API_KEY` set on Vercel (it is — gig picked/rejected emails work). If a new email type doesn't arrive, first confirm any FlipWork email works at all.

---

## Stripe / PayPal removal — cleanup list (May 31 pivot)

The live flow is Stripe-free, but old Stripe code still sits dormant in the repo.
It isn't breaking the live flow; sweep it when convenient.

**Delete entirely (dead, nothing live uses them):**
- API routes: `app/api/stripe/capture-payment/`, `app/api/stripe/connect/*`, `app/api/stripe/payment-method/*`, `app/api/stripe/webhook/`, `app/api/stripe/health/`, `app/api/paypal/health/`
- Libs: `lib/stripe.ts`, `lib/stripe-capture.ts`, `lib/stripe-pick.ts`, `lib/stripe-webhook-handlers.ts`, `lib/payment-math.ts`, `lib/paypal.ts`
- Worker Connect onboarding UI: `app/profile/payments/` (page, PaymentsClient, return/page)
- Components: `components/profile/ProfilePaymentsSection.tsx`, `components/shared/AddPaymentMethodModal.tsx`, `components/shared/PickWorkerConfirmModal.tsx`
- Old payout admin pages: `app/admin/payouts/page.tsx`, `app/admin/payouts/PayoutRow.tsx` (old `payout_records` flow; new flow uses `gig_payments`)

**Keep — still used, just Stripe-named:**
- `app/api/stripe/pick-worker/route.ts` — now only calls `approve_applicant` (no Stripe). The "pick" path.
- `app/api/stripe/cancel-pick/route.ts` + `components/shared/CancelPickButton.tsx` — the "un-pick / reopen" path (use it for the no-show button).

**Edit to remove Stripe bits (file stays):**
- ⚠️ `app/admin/review/[claimId]/ReviewActions.tsx` — **still calls the dead `capture-payment` route. Fix this first** (approve = no charge, like the flipper review), or retire the path.
- `app/flipper/gigs/[id]/page.tsx` — reads `stripe_*` columns for display; harmless until columns dropped.
- `app/gigs/[slug]/page.tsx` + `ClaimButton.tsx` — leftover Stripe props from the old apply-gate.
- `app/u/[username]/page.tsx`, `app/page.tsx`, `components/shared/VerifiedBadge.tsx` — verified-badge refs (badge is parked).
- `app/api/gigs/[id]/delete/route.ts` — cleans up Stripe rows on delete; simplify.
- Minor text refs: `lib/agreements-gate.ts`, `lib/support-prompt.ts`, `lib/support-tools.ts`.

**DB columns — do LAST, carefully:** drop the `stripe_*` columns only AFTER re-pointing `is_user_verified` (currently Stripe-derived). Dropping early breaks the "edit" files above until they're scrubbed. Leaving them is harmless.

**Doc discrepancy to reconcile:** the "watch out" note below says `worker_profiles` uses `full_name`, but `supabase/schema.sql` and several SQL helpers use `first_name`/`last_name` (and the flipper review page reads first/last with a safe "Worker" fallback). Confirm which is actually live before relying on either.

---

## What's next (candidates, not committed)

**From the May 31 payments pivot — do these first:**

1. **Stripe / PayPal cleanup** — sweep the dormant code (full list in the next section). **Start by fixing the admin `ReviewActions.tsx` capture call** — it's the only live landmine.
2. **Ratings & reputation** — NEW build, nothing exists yet. Trust comes from track record now (e.g. "completed 47 gigs, all confirmed paid"). This is the **keystone** — the badge and no-show handling both lean on it. Needs a spec first.
3. **Verified badge** — currently parked/hidden (it ran on Stripe only). Bring back as a track-record badge (from #2) + an optional ID check (good for in-home safety). Lean on history/ID, not photos.
4. **No-show button** — "worker didn't show → reopen the gig" (the un-pick plumbing already exists: `cancel-pick` + `CancelPickButton`). Later, count a no-show against the worker's record (ties to #2). Low priority; not a money issue anymore.
5. **Monetization** — later, NOT a cut of payments: a flat fee to unlock a new worker connection + an optional business subscription (records/crew/tax exports). Workers always free. Charge nothing during the test phase.

**Pre-pivot candidates (still valid):**

1. **Admin screen to review `message_reports`** — reports are being filed with nowhere to view/action them. Highest-value loose end.
2. **Blocked-users management page** — see/unblock all blocks in one place (currently only from inside a thread).
3. **Browse services by category** — the real "find everyone who offers Delivery near me" experience; the proper home for category discovery (search is text-only). Data model already supports it.
4. **Minor cleanup:** notify route should use `getSiteUrl()` instead of hardcoded domain. Place the existing image-report and listing-report buttons + build their admin queues (backends exist, UI doesn't).

---

## This session (May 31, 2026) — summary

The big payments pivot. **Dropped Stripe and the 2% fee entirely**; payments are now free, direct, and off-platform, closed by a two-sided handshake. Built and pushed (live test pending):
- Removed the Stripe apply-gate so workers apply with no onboarding.
- `worker_payout_handles` table + `PayoutHandlesSection` ("How you get paid").
- Hold-free picking (pick route gutted to the `approve_applicant` RPC; dropped the card/hold modals).
- `gig_payments` table + `PayWorkerCard` (poster approves work → pays direct → marks paid) + `ConfirmReceivedCard` (worker confirms receipt).
- Decisions logged: monetization moves to a flat connection fee + later business subscription (not a payment cut); verified badge parked; no-show is no longer a money problem (just reopen the gig).
- **Not done:** the dormant-Stripe-code cleanup (see the cleanup list above) — the only live landmine is the admin `ReviewActions.tsx` capture call.

---

## This session (May 28, 2026) — summary

Supply-side + social expansion. Shipped, all tested by Cory:
- Services offered (tables, manage page, profile section, nav link); trimmed categories to 59.
- User-to-user messaging + Contact Me button; added as 3rd inbox source.
- Inbox archive/delete (`conversation_user_state`), empty-thread filtering, upward-flipping row menu.
- Block + report in chat (`user_blocks` already existed; `message_reports`).
- New-message email notifications via existing Resend pipeline (hourly throttle).
- Site-wide search (header + `/search`) across people/services/listings/gigs; title-only for listings/gigs; Cancel exits cleanly.
- Fixed the long-standing `first_name/last_name` → `full_name` name-display bug in chat + inbox along the way.
