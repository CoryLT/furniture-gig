# FlipWork — Project Context (Claude Project Instructions)

> This is the **standing context** for the FlipWork project. Paste it into the
> Claude Project Instructions so every new conversation starts from reality.
> It changes slowly. For "what we did last session" detail, read `HANDOFF.md`
> in the repo (and the dated `HANDOFF_*.md` files) — that's the living log.
>
> Last rewritten: June 1, 2026, after a full read of the live repo. The old
> context file (simple worker/admin tool, PayPal-only, no marketplace, phases
> 2–7 "not started") was ~6 months stale and was the cause of confused answers.
>
> June 3, 2026 update: refocused on the **operator-hub direction** — see
> "Current direction" below. HANDOFF.md has the full session detail.

---

## What FlipWork actually is (now)

A live, two-sided platform for the **flipping economy**. It started as a
furniture-flipping gig tool ("furniture-gig" is still the code/repo name) and
grew into "anything that can legally be flipped." Real people use it.

The same logged-in user can do any of these — there is no rigid worker/admin
split anymore:

- **Post gigs** (you need furniture work done → you're the "flipper"/poster)
- **Claim/apply to gigs** (you do the work → you're the "worker")
- **Sell items** on a marketplace
- **Advertise services** you offer (up to 10) on your public profile
- **Message** other users, **follow** people, browse a **search** + feed

- **Brand:** FlipWork · **Repo:** `github.com/CoryLT/furniture-gig`
- **Live domain:** myflipwork.com (deployed on Vercel)
- **Operating entity:** Groovy Greens, LLC (NC), d/b/a FlipWork. NC governing
  law; binding arbitration + class waiver in the TOS.
- **Admin:** Cory (single admin). `/admin` is **analytics + support queue only** —
  all gig posting/editing is user-side now.

---

## Current direction (June 2026) — Operator Hub

The focus has narrowed from "two-sided everything-flippable marketplace" to ONE
customer: the **flipping operator** — someone running a flipping business who wants
to hire and manage contract help without Craigslist sketchiness or W-2 overhead.
FlipWork is becoming their **hub / light resource-management ("tycoon") tool**. The
worker/marketplace side still works but is de-emphasized; operator screens now say
**"Jobs"** and **"crew."**

Operator features built (HANDOFF.md has detail):
- **Dashboard `/home`** has a **Business Setup** card — guided check-offs that capture
  business details (name, structure, EIN, bank, bookkeeping, W-9/contractor) into a profile.
- **My Crew** (`/flipper/crew`) — roster + private rating / notes / would-rehire.
- **Payment Records** (`/flipper/records`) — per-worker per-year payouts, a year-correct
  1099 flag ($600 ≤2025, $2,000 2026+), and CSV export.
- **Pipeline** (`/flipper/pipeline`) — pieces Sourced→Sold with photos, an itemized
  expense ledger, and a profit / cash-tied-up HUD (the resource-game core).

New tables: `crew_members`, `business_profiles`, `inventory_pieces`, `piece_expenses`
(`operator_business` is an unused orphan — drop when convenient).

Monetization stays a pro/business subscription (never a cut of payments); validate by
dogfooding + micro-influencer outreach before charging. Standing legal caution: the
contractor model risks worker-misclassification — route Cory to a NC employment/tax
attorney. Not legal advice.

---

## How Cory and Claude work together (NON-NEGOTIABLE)

1. **Claude does ALL the coding.** Cory does NOT copy/paste code, ever. Claude
   clones the repo into its sandbox, edits, commits, and pushes.
2. **One file at a time. Test. Commit. Move on.** No batching.
3. **8th-grade language, no jargon.** Walk Cory through changes in plain English.
4. **Don't ask unless there's a real fork.** When there's one sensible path, just
   do it. Cory often says "use your judgement" — take it. If you must ask, use
   `ask_user_input_v0` with 2–3 options.
5. **Cory sends screenshots / URLs when stuck.** If something only "kinda"
   worked, ask for the URL or screenshot before guessing.
6. **SQL is the ONE copy/paste exception.** Supabase changes can't be done for
   him. Save SQL in `supabase/`, then give crystal-clear steps:
   "open the raw file → copy all → Supabase → SQL Editor → New query → paste → Run."
7. **GitHub raw pages cache hard.** If a re-pushed file looks stale to Cory, send
   the `raw.githubusercontent.com` URL and tell him to hard-refresh (Cmd/Ctrl+Shift+R).
8. Cory can do **basic** VS Code things (pull, push) but is NOT comfortable
   surgically inserting or replacing code. Keep anything you ever ask him to do
   dead simple.

---

## GitHub token + deploy flow

- Cory pastes a **fresh GitHub personal access token** into chat at the start of
  each session. Claude uses it to clone/commit/push. Cory revokes it after the
  session. **That revoke-after-session is the security model — do NOT suggest
  storing it in a file, env var, .env, or secrets manager, and do NOT lecture
  about token security. Just take it and use it.**
- Push from sandbox: `git push https://CoryLT:<TOKEN>@github.com/CoryLT/furniture-gig.git main`
  (or the GitHub Contents API).
- **Vercel does NOT auto-deploy from Claude's API/sandbox pushes.** After Claude
  pushes, Cory runs in VS Code: `git pull` → `git push`, then waits ~45–60s for
  Vercel. Cory's local push is what triggers the deploy.
- **Push gotcha:** when editing via the Contents API, encode the FINAL file
  immediately before the PUT, then read it back from `raw.githubusercontent.com`
  and grep for a marker to confirm — a push has reported "OK" while shipping a
  stale version.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.1 (App Router) |
| Database / Auth / Storage | Supabase (Postgres) |
| Styling | Tailwind 3.3 + Radix UI primitives (manual shadcn-style) |
| Email | Resend (`lib/email.ts`, FROM `notifications@myflipwork.com`) |
| Image moderation | Sightengine (on all upload paths) |
| AI support chat | Anthropic (Haiku 4.5) |
| Deployment | Vercel |

- `next.config.js` has `ignoreBuildErrors` + `ignoreDuringBuilds` true, so TS/
  ESLint won't block a Vercel build. A local `next build` still catches real
  syntax errors — that's the useful pre-push check.
- Fonts: DM Sans (body), DM Serif Display (headings), DM Mono.
- Color: warm neutral base, near-black primary, amber accent (`hsl(32 90% 48%)`).

---

## Payments — DIRECT PAY (Stripe was removed from the live flow, May 31, 2026)

This is the biggest change from the old context file, which is now wrong.

- **No processor, no platform fee, no holds.** FlipWork never touches gig money.
  The old 2%-per-gig fee is **gone**. The poster pays the worker **directly** on
  whatever the worker already uses (Cash App, Venmo, PayPal, Zelle, or cash).
- **Why:** Stripe forced workers through heavy bank+ID onboarding — a wall for
  low-tech, Cash-App-only workers. Free + direct removes that wall.
- **Live flow:**
  1. Worker saves a pay handle on `/profile` ("How you get paid" —
     `components/profile/PayoutHandlesSection.tsx`).
  2. Worker applies — no payment onboarding.
  3. Poster picks the worker — no card, no hold (`/api/stripe/pick-worker` is
     gutted to just the `approve_applicant` RPC).
  4. Worker does checklist + photos → "Submit for review."
  5. Poster approves the work at `/flipper/review/[claimId]` → a **"Pay
     [worker]" card** (`components/shared/PayWorkerCard.tsx`) shows the handle +
     amount + "Mark as paid."
  6. Worker taps **"Did you get paid?"** (`components/shared/ConfirmReceivedCard.tsx`)
     → both sides show "Paid & confirmed."
- **Tables:** `worker_payout_handles` (RLS-gated; only a booked poster can read a
  worker's handle) and `gig_payments` (one row per gig; `marked_paid_at` +
  `worker_confirmed_at` = the two-sided handshake). Both SQL files are run.
- **Dormant Stripe/PayPal code still sits in the repo** (lots of it) but nothing
  live uses it. It isn't breaking anything; sweep when convenient. See
  `HANDOFF.md` for the exact delete/keep/edit list. **The one live landmine:**
  the *admin* review path `app/admin/review/[claimId]/ReviewActions.tsx` still
  calls the dead `capture-payment` route — fix that first if touched.
- **Keep (Stripe-named but still used):** `app/api/stripe/pick-worker/route.ts`
  (the "pick" path) and `app/api/stripe/cancel-pick/route.ts` +
  `CancelPickButton` (the "un-pick / reopen" path).

---

## What's built and working

**Identity & profiles**
- Unified account; anyone can post, claim, sell, or offer services.
- Profile editor `/profile` → `/api/profile/unified-save`.
- Public profile `/u/[username]`: hero card + sections (Available gigs, Services
  offered, Listings for sale, Work Samples). Empty sections hide from strangers.
- A profile with **no username has no public page** and is filtered out of search.

**Gigs**
- Post/edit/browse gigs (city/state filter; own posts get a "Your post" badge).
  Draft flow: step 1 saves `draft`, "Finish & post" flips to `open`.
- **Application/approval flow** (poster reviews applicants and picks one) —
  this replaced the old first-to-claim model.
- Worker execution: `/my-gigs/[claimId]` — checklist, notes, photo uploads,
  submit for review.

**Marketplace**
- `/marketplace`: post/edit/sell/hide items, public feed, photo carousels.
- **Items | Services** toggle — services come from `worker_services`, filtered by
  the provider's profile city.

**Services offered (supply side)**
- Up to 10 per worker. Tables: `service_categories` (59 physical-labor
  categories) + `worker_services` (blurb, price_type, optional cover image).
- Manage at `/profile/worker/services`; shows on the public profile.

**Messaging — THREE kinds**, all unioned in the `/messages` inbox:
1. **Gig** (`gig_conversations`/`gig_messages`)
2. **Listing** (`listing_conversations`/`listing_messages`)
3. **User-to-user** (`user_conversations`/`user_messages`) — "Contact Me" on a
   public profile.
- Inbox/Archived tabs, per-row Archive/Delete (`conversation_user_state`; delete
  is a per-user hide). Block + report from the chat header. New-message email via
  Resend (throttled to ~1 per conversation per recipient per hour). **Gap: no
  admin UI yet to review reported messages.**

**Search** — header bar → `/search`, groups People / Services / Listings / Gigs.
Listings & gigs are **title-only** (deliberate). Logged-out users can search/see
but not act.

**Other shipped**
- Landing: `/` public (founder note), `/home` is the protected logged-in hub.
- AI support chat `/support` (Haiku 4.5; reads the user's own data; escalates to
  admin queue `/admin/support`).
- TOS + Privacy v1.0 live at `/legal/terms` + `/legal/privacy`; unaccepted-
  required agreements gate redirects to `/auth/agreements`.
- Image moderation on all upload paths; HEIC→JPEG in-browser
  (`lib/imageCompression.ts`).
- Founding member system (first 25 workers + 25 flippers; badge + counter).
- Follows/connections, ShareButton, BackToTopButton, message bell, notification
  bell.

Repo scale for reference: ~49 pages, ~52 API routes, ~80 SQL files in `supabase/`.

---

## Load-bearing gotchas (read before editing)

- **Name columns are inconsistent — this is a live bug source.** `full_name` is
  the going-forward column and the canonical save path (`unified-save`) writes it.
  BUT `first_name`/`last_name` were never dropped and **~25 files still read
  them** — those show blank or "User" for anyone whose profile was saved through
  the newer path. `supabase/schema.sql` and `types/database.ts` are STALE here
  (still show first/last only). When you touch a file that displays a worker's
  name, prefer `full_name`; treat any `first_name`/`last_name` read as suspect.
- **`users` table RLS** lets a user read only their OWN row (admins read all). Do
  NOT add an "existence check" against `users` for another user — it false-fails.
  FK constraints already enforce real IDs.
- **SQL ordering:** if a policy references another table, create the referenced
  table FIRST in the file.
- **`/home` is protected** — never send logged-out users there. Public landing is `/`.
- **iPhone HEIC uploads** can have an empty MIME type before conversion — use
  `looksLikeHeic()` / `isAcceptableImageFile()` in `lib/imageCompression.ts`, not
  `file.type`.
- **Vercel deploy** only fires on Cory's local `git push`, not Claude's pushes.
- **Resend** needs `RESEND_API_KEY` on Vercel (it's set). If a new email type
  doesn't arrive, first confirm any FlipWork email works at all.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=
RESEND_API_KEY=
NEXT_PUBLIC_SITE_URL=        (getSiteUrl() helper in lib/utils.ts prefers this)
ANTHROPIC_API_KEY=           (AI support)
SIGHTENGINE_*=               (image moderation)
```
(Plus dormant Stripe keys still referenced by dead code.)

---

## What's next (candidates, not committed)

From the May 31 payments pivot, in priority order:
1. **Stripe/PayPal dead-code cleanup** — start by fixing the admin
   `ReviewActions.tsx` capture call (the only live landmine).
2. **Ratings & reputation** — nothing exists yet; this is the keystone (trust now
   comes from track record, e.g. "47 gigs, all confirmed paid"). Needs a spec.
3. **Verified badge** — currently parked (it ran on Stripe). Rebuild as a
   track-record badge + optional ID check.
4. **No-show button** — reopen a gig when a worker doesn't show (un-pick plumbing
   already exists). Low priority now that it's not a money issue.
5. **Monetization** — later, NOT a cut of payments: a flat fee to unlock a new
   worker connection + optional business subscription. Workers always free.

Pre-pivot loose ends still valid:
- Admin screen to review `message_reports` (reports file with nowhere to action them).
- Blocked-users management page.
- Browse services by category (search is text-only; data model supports it).
- Notify route should use `getSiteUrl()` instead of the hardcoded domain.

---

## How to start a session

Cory pastes a fresh GitHub token. Claude clones the repo, reads `HANDOFF.md` for
the latest session detail, then confirms in plain English what it's about to do
before doing it. Build one file at a time; SQL is the only thing Cory pastes.
