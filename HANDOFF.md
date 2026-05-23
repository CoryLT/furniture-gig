# FlipWork — Handoff

You're picking up Cory's furniture-flipping gig platform. Read this whole thing before doing anything.

---

## Project basics

- **Repo:** https://github.com/CoryLT/furniture-gig
- **Live:** https://myflipwork.com (also furniture-gig-corylts-projects.vercel.app)
- **Cory is on Windows.** Use Windows commands (cd, dir, copy). Repo path: `C:\Users\coryl\OneDrive\Documents\Claude\Projects\Furniture Flipping Gig Work\furniture-gig`
- **Stack:** Next.js 14 (App Router) · Supabase (Postgres + Auth + Storage + Realtime) · Tailwind · Vercel
- **Vercel doesn't always auto-deploy.** After Cory runs `git pull` and `git push` from VS Code, check Vercel. If it didn't kick off a build, he has to manually redeploy (Deployments tab → ⋯ on the latest → Redeploy → uncheck "Use existing Build Cache" → Redeploy).
- **TypeScript:** `next.config.js` has `typescript.ignoreBuildErrors: true`. Pre-existing TS errors throughout the codebase are mostly Supabase `never` type inference issues. Don't try to fix them all. Fix only ones you introduce.

---

## How Cory works (NON-NEGOTIABLE)

1. **You do all the coding.** Cory does NOT copy/paste code. You clone the repo to your sandbox, edit there, commit, push.
2. **One file at a time. Test. Commit. Move on.** No batching.
3. **8th grade language. No jargon.** Walk through what changed in plain English.
4. **Ask before doing if there's a real fork.** Use `ask_user_input_v0` with 2-3 clear options. Don't ask if a small task only has one sensible path.
5. **He'll send screenshots when stuck.** Always ask for the actual URL or screenshot before guessing.
6. **If something says "kinda" worked, ask for the URL right away.** Don't guess.
7. **SQL changes are the one exception to "no copy/paste."** Cory pastes SQL into the Supabase SQL Editor. Keep SQL files in `supabase/` and give him crystal-clear paste instructions.

---

## How to push from your sandbox

You need a GitHub token from Cory each session — they expire. Ask him for one if you don't have it. To make one:

> "Go to github.com → profile picture → Settings → Developer settings (bottom left) → Personal access tokens → Tokens (classic) → Generate new token (classic) → check the 'repo' scope → Generate → copy and paste it to me."

Once you have the token:
```
git push https://CoryLT:<TOKEN>@github.com/CoryLT/furniture-gig.git main
```

After you push, Cory must:
1. Open VS Code → terminal
2. `git pull`
3. `git push`
4. Watch Vercel deploy (or manually trigger if needed)

---

## Current state (what's working)

- Signup / login / unified login (anyone can post OR claim gigs)
- **Unified profile editor at `/profile`** — saves to both `worker_profiles` and `flipper_profiles` tables via `/api/profile/unified-save`
- **Unified public profile at `/u/[username]`** — pulls from both tables, hero card with avatar, name, location, website, stats, bio, skills, and Instagram-style square photo grid
- Old `/workers/[username]` and `/flippers/[username]` routes redirect to `/u/[username]`
- Old `/profile/worker` and `/profile/flipper` pages still exist as dead code, nothing links to them — leave them alone
- Post a gig, edit a gig, browse gigs (with city/state filter; own posted gigs filtered out)
- Claim a gig (exclusive — DB unique constraint; **users can't claim their own gigs**, enforced at UI + DB level)
- "My Gigs" workflow: checklist + photo uploads + submit for review
- Admin review flow at `/admin`
- Payouts tracking (manual PayPal, admin updates status)
- Work Samples photo gallery on profile
- Messaging (per-applicant, not per-gig — see "Application/approval flow" below)
- **Application/approval flow** — workers apply, flipper picks one (replaced old "first-to-claim wins" model)
- **Image moderation via Sightengine** — all uploads blocked for porn / violence / weapons / drugs / gore / offensive / minors
- **User-reported image flagging** — backend API exists but Report button isn't placed on photo views yet
- **Stripe Connect — workers connect** (Phase 1): workers must connect a Stripe Express account before applying; gated apply button on gig detail
- **Stripe Connect — flippers save a card** (Phase 2): when flipper clicks "Pick this worker," a modal collects a card via Stripe Elements (SetupIntent + Customer). Saved off-session for Phase 3 authorize-on-pick.
- **Stripe Connect — authorize on pick** (Phase 3): when flipper picks a worker, a PaymentIntent holds money on their card (`capture_method: manual`). Worker's Connect account is set as `transfer_data.destination`. Platform fee = 2% via `application_fee_amount`.
- **Stripe Connect — capture on approval** (Phase 4): flipper-side review at `/flipper/review/[claimId]`. When flipper approves submitted work, the held PaymentIntent is captured. Stripe auto-transfers (gig amount − 2%) to the worker's Connect account. Verified end-to-end in sandbox.
- **Flipper dashboard with filter/sort + needs-review highlights** — banner appears when any gig has pending applicants, dedicated stat tile, filter chips (All / Needs review / Open / In progress / Completed), sort dropdown (Newest / Oldest / Due soon / Most applicants), pending gigs always float to top under "All". Note: does NOT yet surface "work submitted, awaiting your review" — that's a known gap (see What's Next #7).

---

## Messaging system

Bucket 1 #2. Note: with the application/approval flow refactor, there is now ONE conversation per (gig, applicant) rather than one per gig. See that section for the details.

### What's there
- **`/messages` inbox** — list of all conversations, sorted by recency, with unread badges per row and a total unread summary up top
- **`/messages/[conversationId]` chat page** — message bubbles, type-and-send composer, realtime delivery, "is typing" indicator (bouncing dots), read receipts ("Sent" / "Seen")
- **"Message Flipper" button** on worker's My-Gig detail page (`/my-gigs/[claimId]`)
- **"Message Worker" button** on each active claim in flipper's gig page (`/flipper/gigs/[id]`)
- **Realtime unread badge** in the top nav next to "Messages" — ticks up when new messages arrive on ANY page (not just the inbox), ticks back down when read
- **"Messages" link** in top nav (between "My Posted Gigs" and "Payouts")

### Key DB tables (in `supabase/schema_messaging.sql`, `schema_messaging_patch_poster.sql`, and `schema_application_flow.sql` — all already run)
- `gig_conversations` — one row per (gig, worker) — `UNIQUE(gig_id, worker_user_id)`. Stores `flipper_user_id`, `worker_user_id`, `last_message_at`. RLS allows only the two participants to read/insert/update.
- `gig_messages` — actual messages. Stores `conversation_id`, `sender_user_id`, `body`, `read_at`, `created_at`. RLS: participants can SELECT and INSERT; recipients can UPDATE read_at on messages they did NOT send.
- A trigger on `gig_claims` INSERT auto-creates the conversation when status is `pending` OR `active`. Uses `coalesce(poster_user_id, created_by)` for the flipper.
- A trigger on `gig_messages` INSERT bumps `last_message_at` on the parent conversation.
- Both tables added to `supabase_realtime` publication for client subscriptions.

### Key code files
- `app/messages/layout.tsx` — auth + Nav wrapper, looks up username from worker OR flipper profile.
- `app/messages/page.tsx` — inbox (server component). Queries conversations + latest 500 messages, computes preview + unread per conversation in-memory.
- `app/messages/[conversationId]/page.tsx` — chat page (server). Loads conversation, gig, other-user profile info.
- `app/messages/[conversationId]/ChatClient.tsx` — the actual realtime chat (client). Subscribes via `supabase.channel(\`conversation:${conversationId}\`)` to Postgres INSERT/UPDATE events AND broadcast `typing`/`stop_typing` events.
- `components/shared/OpenChatButton.tsx` — reusable "Message" button that POSTs to the start endpoint.
- `app/api/messages/start/route.ts` — find-or-create conversation by gig_id. Validates the caller is a participant.
- `components/shared/Nav.tsx` — has the realtime unread badge logic (loadAndSubscribe in useEffect). Subscribes to all `gig_messages` INSERT/UPDATE events; RLS already restricts to visible ones.

### Quirks worth knowing
- The chat client uses **optimistic UI** — when you send a message, it appears immediately as `pending`, then the realtime INSERT replaces it. There's merge logic to avoid duplicate rendering.
- The typing indicator throttles broadcasts to once per 1.5s. Stops broadcasting on blur or empty input.
- The unread badge in Nav has TWO triggers: (1) realtime subscription to inserts/updates, and (2) a 1.2s delayed refetch when the user navigates to anything under `/messages` (to catch read_at updates that may be in flight). Both work in tandem.
- The chat page header avatar/name links to `/u/[username]` if a username exists — handy for flippers vetting workers.

---

## Self-claim bug fix (shipped previous session)

Cory noticed users could claim their own gigs. Three layers of fix:

1. **`app/gigs/page.tsx`** — browse list excludes gigs where `poster_user_id` OR `created_by` matches the user.
2. **`app/gigs/[slug]/page.tsx` + `ClaimButton.tsx`** — if viewer posted this gig, show "You posted this gig" with a button to the dashboard instead of a Claim button.
3. **`supabase/schema_prevent_self_claim.sql` (already run)** — DB trigger refuses INSERT/UPDATE on `gig_claims` if `worker_user_id` matches the gig's poster. Also cleans up any pre-existing self-claims and resets affected gigs from `claimed` → `open`.

---

## Application/approval flow (DONE — shipped previous session)

Replaced the old "first-to-claim wins" exclusive claim model.

### The flow
1. Flipper posts gig (unchanged)
2. Multiple workers APPLY → claim row created with status `'pending'`
3. Conversation auto-created for each applicant the moment they apply (so flipper can chat with them pre-pick)
4. Flipper reviews applicants in dashboard, can Message any of them
5. Flipper clicks "Pick this worker" on one → DB function `approve_applicant(uuid)` runs:
   - That claim → `'active'`, gig → `'claimed'`
   - All OTHER pending claims → `'rejected'`, system message posted to each rejected applicant's conversation: "This gig was assigned to another worker. Thanks for applying!"
6. From here, the existing checklist / photo / submit flow takes over unchanged

### Design decisions Cory made
- Messaging opens AS SOON AS someone applies (pre-pick screening)
- Applicants see a count of how many others applied
- Worker's "My Applications" lives as a separate tab on `/my-gigs?tab=applications`
- Rejection sends a system message to the rejected applicant's chat

### Schema changes (`supabase/schema_application_flow.sql` — already run)
- `gig_claims`: dropped `UNIQUE(gig_id)`, added `UNIQUE(gig_id, worker_user_id)`. Added `'pending'` to the status check constraint.
- `gig_conversations`: dropped `UNIQUE(gig_id)`, added `UNIQUE(gig_id, worker_user_id)` so each applicant has their own conversation with the flipper.
- `create_conversation_on_claim` trigger updated to fire on `pending` OR `active` (not just `active`).
- New SECURITY DEFINER functions: `approve_applicant(p_claim_id uuid)` and `reject_applicant(p_claim_id uuid)`. Both check caller is the gig poster (or admin). Approve also rejects all other pending applicants and posts system messages.

### Key code changes
- `app/gigs/[slug]/ClaimButton.tsx` — now an Apply button. Shows applicant count. Different states for "haven't applied", "pending", "picked", "rejected", "own gig".
- `app/gigs/[slug]/page.tsx` — loads ALL claims for the gig (not just one), computes `myClaim`, `activeClaim`, `pendingApplicantCount`.
- `app/flipper/gigs/[id]/page.tsx` — split into "Picked worker" / "Pending applicants" / "Past applicants" sections. Each pending applicant gets a Message button + Approve/Reject.
- `app/flipper/gigs/[id]/ApplicantActions.tsx` — client component that calls `approve_applicant` / `reject_applicant` RPCs.
- `app/my-gigs/page.tsx` — three tabs: Active / Applications / History (driven by `?tab=` query param).
- `app/api/messages/start/route.ts` — now accepts `workerUserId` so the flipper can specify which applicant they're chatting with. If a worker calls it, it defaults to caller.
- `components/shared/OpenChatButton.tsx` — accepts optional `otherUserId` prop.
- `types/database.ts` + `lib/utils.ts` — added `'pending'` to claim status type + label/class maps.

### Quirks worth knowing
- The Supabase RPC calls in `ApplicantActions.tsx` use a `(supabase.rpc as unknown as ...)` cast because Supabase's generics don't know about custom functions. Standard TS workaround.
- The flipper inbox at `/messages` now shows one row per (gig, applicant) — could be the same gig title repeated. This is intentional and correct.
- After rejection, the worker's `/my-gigs/[claimId]` page still shows the full checklist UI. That's a known TODO — should show a "not picked" state instead.

---

## Image moderation (DONE — shipped previous session)

Sightengine integration. All 5 upload paths gated.

### What gets blocked
nudity-2.1 (sexual + suggestive) · weapon · recreational_drug · gore-2.0 · violence · offensive-2.0 · face-attributes (minor detection)

### Block UX
Per Cory's pick: **silent failure** — vague "Upload failed. Please try a different image." Same message regardless of which model triggered. Avoids reverse-engineering.

### Env vars (set on Vercel)
- `SIGHTENGINE_API_USER` = `203445561`
- `SIGHTENGINE_API_SECRET` = **NEEDS ROTATION** — the original was pasted in chat. As of end of session, the same exposed secret is still in production. Cory needs to regenerate in Sightengine dashboard and update Vercel. Tell him this is the FIRST thing to do.

### Cost / limits
Sightengine free tier: 2,000 ops/month, 500/day cap. Each image = 7 ops (7 models enabled). So free tier = ~285 images/month. Starter is $29/mo for 10,000 ops. Will outgrow free quickly post-launch.

### Schema (`supabase/schema_image_moderation.sql` — already run)
- `moderation_log` — every check, pass or fail, with raw scores. Admin-only SELECT via RLS.
- `image_reports` — user-reported images. Reporter can SELECT own; admin can SELECT/UPDATE all.

### Key code files
- `lib/moderation.ts` — single `moderateImage(file)` function. Thresholds are tuned conservatively. `logModerationCheck` helper writes to `moderation_log` (never throws — silent on logging failures).
- `app/api/upload-avatar/route.ts` — moderation gate added.
- `app/api/upload-flipper-gallery-photo/route.ts` — moderation gate added.
- `app/api/upload-worker-gallery-photo/route.ts` — moderation gate added.
- `app/api/upload-gig-photo/route.ts` — **NEW route**. PhotoSection now posts here instead of uploading direct to Supabase Storage.
- `app/api/upload-gig-image/route.ts` — **NEW route**. GigImageUploader now posts here instead of uploading direct to Supabase Storage.
- `app/my-gigs/[claimId]/PhotoSection.tsx` — converted from direct storage upload → API call.
- `components/admin/GigImageUploader.tsx` — converted from direct storage upload → API call.
- `app/api/report-image/route.ts` — accepts user reports.
- `components/shared/ReportImageButton.tsx` — modal dialog client component. **NOT YET PLACED ON ANY PHOTO VIEW.** Has to be slotted into gallery cards, gig photo grids, avatar viewers, etc. That's TODO.
- `app/admin/reports/page.tsx` — admin reports queue, Pending/Resolved tabs.
- `app/admin/reports/ReportActions.tsx` — Remove / Keep / Dismiss buttons.
- `app/api/admin/resolve-report/route.ts` — handles report actions. For 'remove', deletes from storage AND from the corresponding DB table (avatar is special — clears the `avatar_url` column instead).
- `app/admin/page.tsx` — added "Image Reports" tile (replaced "Post New Gig" tile, which was redundant with the Manage Gigs page).

### Quirks worth knowing
- Thresholds are tuned strict. Real-world false positives will happen — adjust `THRESHOLDS` in `lib/moderation.ts` based on what's in `moderation_log`.
- The `minor` detection threshold is 0.6. People near 18 sit around 0.5 confidence (per Sightengine docs). 0.6 should reliably catch kids but might block college-age workers. Tunable.
- Sightengine returns `nudity-2.1` as an object with sub-classes (`sexual_activity`, `sexual_display`, `erotica`, `sextoy`, `suggestive`, `mildly_suggestive`, etc.). Code iterates over the sexual ones at threshold 0.4 and suggestive ones at threshold 0.5.
- `weapon`, `recreational_drug`, `gore`, `violence`, `offensive` can return either a scalar number or an object with `classes`. Code handles both shapes defensively.

---

## Auth + mobile polish (DONE — shipped previous session)

Three small but high-impact bug fixes plus a UX tweak.

### 1. Google sign-in required two clicks
**Symptom:** clicking "Sign in with Google" on first attempt redirected to the landing page; second attempt worked.

**Root cause:** race condition in `app/auth/finishing/page.tsx`. The page POSTs OAuth tokens to `/api/auth/set-session` which writes the auth cookie via Set-Cookie. The page then immediately called `window.location.replace(target)`. The browser hadn't fully committed the cookie before the next navigation, so middleware on the destination page saw no auth cookie and bounced the user back to `/`.

**Fix:** added `router.refresh()` + a 150ms `await new Promise(setTimeout)` between the fetch and the redirect. Gives the browser time to commit the Set-Cookie header before the destination page's middleware runs. File: `app/auth/finishing/page.tsx`.

### 2. Vercel SSO login page appearing on mobile production
**Symptom:** visiting `myflipwork.com` on phone showed Vercel's "Log in to Vercel" page instead of the FlipWork landing page.

**Root cause:** Vercel Deployment Protection was on for production.

**Fix:** Vercel dashboard → Settings → Deployment Protection → set to "Only Preview Deployments." No code change. **Important for future:** if Cory ever connects a new domain or migrates the project, this setting could come back on. Check it.

### 3. Mobile nav menu items squished into one line
**Symptom:** on mobile, the hamburger menu opened but the top section of nav links appeared as a single squished row instead of stacking.

**Root causes (two bugs in one):**
- **No viewport meta tag.** Next 14 App Router requires explicit `export const viewport: Viewport` in `app/layout.tsx`. Without it, mobile browsers render at a fake ~980px width and Tailwind's `md:` breakpoints behave like desktop everywhere. Adding the viewport export fixed the breakpoint logic.
- **Mobile menu links used `inline-flex` instead of `flex`.** `inline-flex` makes elements flow side-by-side like text. Switching to `flex` makes each link a full-width row. Bottom section (My Profile, Account Settings, Support, Logout) already used `block` and worked fine — only the top section (the `links.map(...)` block) had the issue.

**Files changed:**
- `app/layout.tsx` — added `export const viewport`
- `components/shared/Nav.tsx` — mobile menu links now use `flex items-center gap-2 py-2.5 px-2 rounded-md`, with hover background and active-route highlight.

### 4. Logo links to /gigs for non-admins
Cory wanted the FlipWork logo in the top nav to send workers/flippers to `/gigs` (Browse Gigs) instead of `/` (landing page). Admins still go to `/`. One-line change in `components/shared/Nav.tsx`:
```ts
const logoHref = role === 'admin' ? '/' : '/gigs'
```
Then `<Link href={logoHref}>` on the logo. Logos on auth pages (login, signup) still point to `/` — that's correct since those users aren't logged in.

---

## Stripe Connect payout system (IN PROGRESS — foundation shipped)

Cory pivoted from "polish the manual PayPal flow" to "do payouts right." We're building a full Stripe Connect (Express) marketplace. This replaces ALL of the prior manual-PayPal payout planning.

### Decisions locked in
- **Money model:** Flipper → Platform → Worker (platform holds money in the middle, automatically distributes via Stripe)
- **Platform fee:** **2%** of the gig amount (configurable via Vercel env `STRIPE_PLATFORM_FEE_PERCENT`)
- **Charge timing:** Authorize on pick, capture on admin approval (protects flipper; if work rejected, hold is released without charge)
- **Stripe fees:** Flipper pays Stripe's processing fees ON TOP of the gig amount. Worker always receives full advertised gig pay minus the 2% platform cut.
- **Account type:** Stripe Express (NOT Standard, NOT Custom) — Stripe handles all the worker KYC/bank/ID via their hosted onboarding
- **Test environment:** New-style Sandbox called "Flipwork Dev" (account `acct_1TZNIGRrFKq5pWBh`). The old legacy "Test mode" environment was abandoned during setup — don't reference it.
- **Live Stripe account:** `acct_1TYz1nRplyBq5wmm` (FlipWork live). NOT activated yet. Cory has the live secret key written on paper. We are NOT touching live mode until everything tested in sandbox.

### What's shipped (foundation — commit `62c9a78`)
- `lib/stripe.ts` — server-side Stripe client + `calculatePaymentBreakdown()` helper (all the fee math)
- `supabase/schema_stripe_connect.sql` — RUN — adds Stripe tracking columns:
  - `worker_profiles`: `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_details_submitted`, `stripe_onboarding_completed_at`
  - `users`: `stripe_customer_id` (for flippers' saved payment methods)
  - `payout_records`: `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_transfer_id`, `flipper_user_id`, `gross_amount`, `stripe_fee_amount`, `platform_fee_amount`, `payment_status` (enum: none/requires_method/authorized/captured/transferred/failed/canceled/refunded)
  - Two indexes for fast lookups
- `app/api/stripe/health/route.ts` — admin-only `/api/stripe/health` endpoint. GET it as admin to verify Stripe credentials, Connect status, and platform fee math. **Confirmed working — returned `"ok": true` end-to-end.**
- `package.json` — `stripe@^16.12.0`, `@stripe/stripe-js@^4.10.0`, and `@stripe/react-stripe-js@^2.8.0` installed
- Vercel env vars set (Production + Preview + Development):
  - `STRIPE_SECRET_KEY` (test mode, ends in `KEuj`)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode)
  - `STRIPE_PLATFORM_FEE_PERCENT=2`

### Build phases — what's left
| # | Phase | Status |
|---|---|---|
| 0 | Stripe account, sandbox, Connect, env vars, SQL, foundation code | ✅ DONE |
| 1 | Worker Stripe onboarding flow — "Connect your Stripe" button → Stripe Express hosted onboarding → callback saves account ID | ✅ DONE |
| 2 | Flipper saved payment method — Stripe Elements form when picking worker; create Customer + PaymentMethod | ✅ DONE |
| 3 | Authorize on pick — wire `approve_applicant` to create PaymentIntent with `capture_method: manual`, `transfer_data.destination` = worker's Connect acct, `application_fee_amount` = 2% | ✅ DONE |
| 4 | Capture on approval — wire flipper "approve work" to call `paymentIntents.capture()` (auto-transfers to worker) | ✅ DONE |
| 5 | Worker payout UI — show payment status, Stripe Express dashboard link, payout schedule | NEXT |
| 6 | Admin payout UI upgrade — show Stripe payment intent ID, status, refund button | |
| 7 | Stripe webhooks — `/api/stripe/webhook` to handle account.updated, payment_intent.succeeded/.failed, transfer.created, etc. Needs `STRIPE_WEBHOOK_SECRET` env var. | |
| 8 | Edge cases — cancellations, refunds, failed cards, expired authorizations (Stripe auths expire after 7 days for cards) | |
| 9 | Go-live — activate live Stripe account, swap env vars to live keys, test one real $1 transaction | |

### Phase 1 — Worker Stripe onboarding (DONE — shipped previous session)

Workers must now connect a Stripe Express account before they can apply to any gig.

**The flow**
1. Worker opens `/profile` — sees a new "Payments" card with status
2. Card links to `/profile/payments` — a dedicated page that fetches live status from Stripe
3. "Connect Stripe account" → POSTs to `/api/stripe/connect/onboard`
4. Server creates a Stripe Express account (with `card_payments` + `transfers` capabilities), saves the ID to `worker_profiles.stripe_account_id`, returns a hosted `accountLink.url`
5. Worker is redirected to Stripe's hosted onboarding form (Stripe handles bank info, SSN, ID verification — FlipWork never sees any of it)
6. Stripe sends them back to `/profile/payments/return` — which calls `stripe.accounts.retrieve()`, syncs `charges_enabled`/`payouts_enabled`/`details_submitted` flags to the DB, and shows a success or "almost there" message
7. On the gig detail page, if the worker's Stripe isn't fully ready, the Apply button is replaced with a "Set up payments to apply" CTA linking to `/profile/payments`

**Key code files**
- `app/api/stripe/connect/onboard/route.ts` — POST. Creates Express account if missing, returns onboarding URL.
- `app/api/stripe/connect/refresh/route.ts` — GET. Stripe redirects here if the link expires; we regenerate and bounce them back to Stripe.
- `app/api/stripe/connect/return/page.tsx` — Where Stripe sends users post-onboarding. Server-side fetches account state and syncs to DB. (Lives at `app/profile/payments/return/page.tsx` actually — the `return_url` passed to Stripe is `${origin}/profile/payments/return`.)
- `app/api/stripe/connect/status/route.ts` — GET. Returns fresh status from Stripe (also syncs DB). Used by client components to refresh status without a full page load.
- `app/api/stripe/connect/login-link/route.ts` — POST. Generates a one-time Stripe Express Dashboard login link so the worker can manage their account (update bank, view payouts, etc.).
- `app/profile/payments/page.tsx` + `PaymentsClient.tsx` — the dedicated payments page.
- `app/profile/payments/return/page.tsx` — the post-onboarding return page.
- `components/profile/ProfilePaymentsSection.tsx` — the summary card on `/profile`.
- `app/profile/page.tsx` — added `<ProfilePaymentsSection />` between the main form card and the Work Samples card.
- `app/gigs/[slug]/page.tsx` — now loads `stripe_*` columns and passes `stripeReady` + `stripeStarted` to ClaimButton.
- `app/gigs/[slug]/ClaimButton.tsx` — new `stripeReady` / `stripeStarted` props. If !stripeReady, the apply form is replaced with a "Set up payments to apply" link to `/profile/payments`.

**Quirks worth knowing**
- All Stripe-touching DB writes use `as any` casts because `types/database.ts` doesn't have the Stripe columns yet. That's the same pattern HANDOFF already calls out for Supabase `never` type issues. If you need to update those types later, you'll need to add: `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_details_submitted`, `stripe_onboarding_completed_at` to `worker_profiles`.
- `ProfilePaymentsSection` always shows on `/profile`, regardless of whether the user is primarily a worker or flipper. That's intentional — anyone might apply to a gig.
- The status endpoint syncs Stripe → DB on every call. That keeps the DB cache fresh without webhooks. We'll add webhooks in Phase 7 for instant updates from Stripe's side, but pull-on-demand is fine for now.
- `Stripe.accounts.retrieve()` is a real API call (not cached). The `/profile/payments` page calls it once on load via `/api/stripe/connect/status`. If this gets slow, we could cache the DB-stored flags and only re-fetch on user action.

### Phase 2 — Flipper saves a card before picking (DONE — shipped this session)

When a flipper clicks "Pick this worker" on a pending applicant, we now require them to have a saved Stripe card on file. If they don't, a modal pops open with Stripe Elements; once they save a card, the pick auto-resumes. This sets up the rails for Phase 3 (authorize-on-pick).

**The flow**
1. Flipper clicks "Pick this worker" on `/flipper/gigs/[id]`
2. Browser GETs `/api/stripe/payment-method/status` — does the caller have any saved cards?
3. If yes → straight to `approve_applicant` RPC (existing flow, unchanged)
4. If no → modal opens; we POST `/api/stripe/payment-method/setup-intent`, which creates a Stripe Customer for the flipper (if needed), saves `users.stripe_customer_id`, and returns a SetupIntent `client_secret`
5. Modal mounts `<Elements>` with that client_secret and shows the PaymentElement
6. On submit, `stripe.confirmSetup({ redirect: 'if_required' })` attaches the card to the Customer for off-session reuse
7. Modal closes, `runApprove()` resumes automatically, gig flips to `claimed`, other applicants get rejected via the existing `approve_applicant` function

**Key code files**
- `app/api/stripe/payment-method/setup-intent/route.ts` — POST. Creates Customer if missing, returns SetupIntent client_secret. Uses `(supabase as any).from(...)` cast for the `stripe_customer_id` update because the column isn't in `types/database.ts` yet.
- `app/api/stripe/payment-method/status/route.ts` — GET. Returns `{ hasPaymentMethod, paymentMethods[] }`. Each PM in the list has `id`, `brand`, `last4`, `expMonth`, `expYear`.
- `components/shared/AddPaymentMethodModal.tsx` — Stripe Elements modal. Module-level `stripePromise` cached via `loadStripe()`. Theme tokens match FlipWork (`colorPrimary: '#0a0a0a'`, DM Sans font, 8px border radius). Modal is scrollable (`max-h-[90vh] overflow-y-auto`) so it works on smaller viewports — earlier version got reported by Cory as not fitting his screen.
- `app/flipper/gigs/[id]/ApplicantActions.tsx` — `handleApprove()` now hits `/api/stripe/payment-method/status` first. If `hasPaymentMethod` is false, sets `pendingPickAfterCard=true` and opens the modal. `handleCardSaved()` resumes `runApprove()` automatically.

**Quirks worth knowing**
- `Elements` is rendered conditionally on `clientSecret` — it can't mount before the SetupIntent comes back. Keep that.
- `confirmSetup` with `redirect: 'if_required'` is critical — the default behavior is a full-page redirect, which would break the auto-resume after card save.
- The modal resets `clientSecret` to null on close so reopening starts a fresh SetupIntent (avoids stale client_secret bugs).
- The `confirm("Pick X for this gig? Everyone else who applied will be rejected.")` runs BEFORE the payment-method check, so if the flipper bails out at the confirm, we never hit Stripe. Good.
- `@stripe/react-stripe-js@^2.8.0` was added to package.json. `npm install` was run in the sandbox so package-lock.json is updated.

### Phase 3 — Authorize on pick (DONE — shipped this session)

When a flipper picks a worker, the flipper's saved card is now authorized (NOT captured) for the full payment amount. The money sits frozen on the card until admin approves the work in Phase 4, at which point Stripe will capture it and auto-transfer to the worker's Connect account. If anything goes wrong post-hold (DB approve fails, etc.), the authorization is automatically released so flippers never get stuck with phantom holds.

**The flow**
1. Flipper clicks "Pick this worker" → confirmation dialog now mentions the hold
2. Frontend checks for a saved card (existing Phase 2 flow). If none, the add-card modal opens; on save, the pick auto-resumes.
3. Frontend POSTs `{ claimId }` to `/api/stripe/pick-worker`
4. Server validates: caller is the gig poster (or admin), claim is still `pending`, gig has a valid pay_amount, flipper has a Stripe Customer, **worker has Stripe charges_enabled** (block path — if not ready, error out before touching money)
5. Server calls `stripe.paymentIntents.create()` with `capture_method: 'manual'`, `off_session: true`, `confirm: true`, `transfer_data.destination` = worker's Connect acct, `application_fee_amount` = 2% of gig amount in cents. Idempotency key = `pick:${claimId}` so double-clicks don't double-charge.
6. If Stripe returns `requires_action` (3D Secure), server passes the `client_secret` back to the frontend, which runs `stripe.confirmCardPayment(clientSecret)`, then re-calls the endpoint. Idempotency key lets the retry pick up the same PaymentIntent in its new state.
7. On `requires_capture` (success), server inserts a `payout_records` row with `payment_status='authorized'`, the PaymentIntent ID, full breakdown (`gross_amount`, `stripe_fee_amount`, `platform_fee_amount`, `amount` = worker receives).
8. Server calls the existing `approve_applicant` RPC — that worker wins, others get rejected (unchanged behavior).
9. If the DB insert or the RPC fails AFTER the Stripe hold, server calls `stripe.paymentIntents.cancel()` to release the hold, then marks the payout row `canceled`. Flipper is never charged for a failed pick.

**Key code files**
- `lib/stripe-pick.ts` — `authorizePickPayment()` (creates the PaymentIntent, handles `requires_action`/`requires_capture`/failure) and `cancelPickAuthorization()` (best-effort release).
- `app/api/stripe/pick-worker/route.ts` — the orchestrator. Does all the validation, calls the helper, writes the payout row, calls the RPC, handles every rollback path.
- `app/flipper/gigs/[id]/ApplicantActions.tsx` — `runApprove()` now POSTs to the new endpoint instead of calling the RPC directly. Handles the 3DS flow via `loadStripe` + `confirmCardPayment` + automatic retry.

**Schema changes** (in `supabase/`, both run on production)
- `schema_phase3_authorize_on_pick.sql` — adds index on `payout_records.flipper_user_id` and a SELECT RLS policy so flippers can see their own payout rows.
- `schema_phase3_payout_records_rls.sql` — adds INSERT and UPDATE RLS policies for `payout_records` (existing schema only allowed worker SELECT + admin ALL). Without this, the route's insert was silently blocked. Discovered during first end-to-end test; auto-rollback worked exactly as designed (the failed test left no money stuck — the canceled PaymentIntent was visible in Stripe sandbox).

**Quirks worth knowing**
- All Stripe-touching writes use `as any` casts because `types/database.ts` is still out of sync with the Stripe columns (HANDOFF TODO #8). When the types get regenerated, those casts can come out.
- The `confirm(...)` dialog text was updated to warn flippers that money will be held now: "Money for this gig will be held on your card now. It won't be charged until the work is approved."
- The route uses **separate queries** (no Supabase embed-joins) for the same RLS reason called out elsewhere in HANDOFF — joins silently return null under RLS without an error.
- There is a tiny race window: two simultaneous picks for different applicants on the same gig could both pass the `claim.status === 'pending'` check, both authorize, and the loser's hold would stick around until the auto-cancel fires. Not common (one flipper, one screen) but worth knowing. A future fix would be to lock the gig row before authorizing.
- The first test failed with "Could not save payment record. Authorization was released." This was the missing INSERT RLS policy on `payout_records` — fixed by `schema_phase3_payout_records_rls.sql`. The auto-rollback's PaymentIntent.cancel() correctly released the $26.06 hold (visible in Stripe sandbox).
- The breakdown returned by `/api/stripe/pick-worker` on success includes `gigAmount`, `flipperPays`, `workerReceives`, `platformFee`, and `stripeFee` — useful for any future UI that shows the flipper their charge breakdown post-pick.

### Flipper applicant visibility — RLS fixes (DONE — shipped this session)

When testing Phase 2, Cory found that after a worker applied to a gig, the flipper saw "0 Applicants" on `/flipper/gigs/[id]` and "0 claims" on the dashboard. Worker side correctly showed "Pending". This was three layered RLS bugs that had been there since the application/approval refactor — nobody had tested the flipper side from a non-admin account.

**Root cause:**
- `gig_claims` RLS only allowed the worker (own claims) and admin. No policy for the gig poster.
- `worker_profiles` RLS only allowed the profile owner and admin. So even after we fixed gig_claims, the embedded `worker_profiles(...)` join on the gig page silently returned nothing — Postgres returns the parent row with `worker_profiles: null` when an embed-join hits RLS, and the page's `?? null` chain made the applicant card collapse.

**Schema changes** (both already run on production):
- `supabase/schema_fix_poster_can_see_claims.sql` — adds policy `"Posters can view claims on their gigs"` on `gig_claims` for SELECT. USING clause checks `exists (select 1 from gigs g where g.id = gig_claims.gig_id and coalesce(g.poster_user_id, g.created_by) = auth.uid())`.
- `supabase/schema_fix_poster_can_see_applicant_profiles.sql` — adds policy `"Posters can view applicant profiles"` on `worker_profiles` for SELECT. USING checks that the row's `user_id` has a claim on a gig the caller posted.

**Code change** in `app/flipper/gigs/[id]/page.tsx`:
- Split the single `gig_claims` + `worker_profiles(...)` embed-join into two separate queries (load claims, then load profiles by `user_id IN (...)` and stitch them in JS). This makes the page more robust to any future RLS quirks and was the change that finally made applicants render after the two policy fixes.
- Added `export const dynamic = 'force-dynamic'` + `export const revalidate = 0` to ensure no stale page caches.

### Flipper dashboard upgrade (DONE — shipped this session)

After the RLS fixes, Cory asked for a way to see at a glance which gigs need him to pick a worker. Added a needs-review banner, a pending-applicants stat tile, filter chips, and a sort dropdown to `/flipper/dashboard`.

**What's new**
- Conditional **banner at the top** (only renders when there are pending applicants): "X gigs need your review — Y pending applicants waiting to be picked. Tap to see them below." Anchor-links to `#your-gigs`.
- Stats grid expanded from 4 to 5 tiles. New tile: **"Pending applicants"** with accent ring/border when count > 0.
- New client component `app/flipper/dashboard/FlipperGigList.tsx` handles filter/sort UI and rendering. Page-level component remains a server component for data fetching.
- **Filter chips**: All / Needs review / Open / In progress / Completed
- **Sort dropdown**: Newest first (default) / Oldest first / Due date (soonest) / Most applicants
- Gigs with pending applicants **always float to the top** under the "All" filter regardless of sort selection. Each such gig gets an accent-bordered card and an inline badge: "X pending applicants — needs review".
- Dashboard set to `force-dynamic` / `revalidate=0` since counts change constantly.

**Files**
- `app/flipper/dashboard/page.tsx` — fetches gigs + claims, computes `totalClaimsByGig` and `pendingClaimsByGig` separately. Banner + stats + empty state stay in the server component; the list is passed to the client component.
- `app/flipper/dashboard/FlipperGigList.tsx` — `FilterKey` and `SortKey` typed. `visibleGigs` is memoized on filter/sort changes. The "float pending to top" sort is layered on top of the user's chosen sort, NOT replacing it.

### Phase 4 — Capture on approval (DONE — shipped this session)

When the flipper (NOT admin — see "important pivot" below) approves submitted work, the previously-held Stripe PaymentIntent is captured. Stripe automatically transfers (gig amount − 2%) to the worker's Connect account and the 2% application fee lands in our platform balance.

**Important pivot from the original plan**
The HANDOFF previously called this "wire admin's approve button." Wrong — the actual reviewer in this app is the **flipper who posted the gig**, not the admin. The old `/admin/review/[claimId]` page is still there but isn't part of the main flow. Phase 4 built a parallel flipper-side review page that mirrors it.

**The flow**
1. Worker submits work → `gig_claims.status` flips to `submitted_for_review`
2. Flipper visits `/flipper/gigs/[id]` — sees a new top-level **"Work submitted for review"** section with a Review work button. (Active-claim + pending-applicants sections hide while work is under review so the flipper has one clear next action.)
3. Click **Review work** → lands on `/flipper/review/[claimId]` — checklist + flipper's reference photos + worker's proof photos + approve/reject buttons
4. Click **Approve & capture payment** → POSTs to `/api/stripe/capture-payment`
5. Route verifies caller is poster (OR admin as a fallback), looks up the payout_records row by `gig_id` + `worker_user_id`, calls `stripe.paymentIntents.capture()`, updates `payment_status='captured'` and legacy `payout_status='paid'`, returns ok
6. Client then updates `gig_claims.status='approved'` and `gigs.status='completed'` (needs the new RLS policy below)
7. Stripe asynchronously transfers worker's cut. Worker sees the payout as "Pending" on `/my-gigs/payouts` until Stripe completes the bank transfer (~7-14 days for new Connect accounts).

**Key code files**
- `lib/stripe-capture.ts` — `capturePickPayment(paymentIntentId)`. Calls `stripe.paymentIntents.capture()`. Returns `{ status: 'ok'|'failed' }`. No idempotency key needed; if you capture an already-captured PI Stripe throws and the caller surfaces a message.
- `app/api/stripe/capture-payment/route.ts` — the orchestrator. Auth check is "poster of this gig OR admin." Looks up the payout_records row, short-circuits to ok if it's already captured (idempotent), graceful no-op for legacy gigs without a Stripe PI. Updates payment_status to 'captured' AND legacy payout_status to 'paid' so the existing admin payouts UI shows the row in the paid bucket.
- `app/flipper/review/[claimId]/page.tsx` — flipper-side review page. Mirrors `/admin/review/[claimId]/page.tsx` but scoped to gigs the caller posted (redirects to dashboard if not).
- `app/flipper/review/[claimId]/FlipperReviewActions.tsx` — client component. POSTs to capture-payment, then updates claim/gig status. Uses `.select()` on every update + checks both error AND row count so silent RLS blocks surface as visible errors instead of phantom redirects.
- `app/flipper/gigs/[id]/page.tsx` — split `submitted_for_review` out of `otherClaims` into its own prominent section with a Review work button. Active + pending sections hide when there's a submitted claim.
- `app/admin/review/[claimId]/ReviewActions.tsx` — admin-side equivalent. Same approve flow, calls the same endpoint, in case admin needs to step in.

**Schema changes** (already run on production)
- `schema_phase4_poster_can_review.sql` — new RLS policy "Posters can update claims under review" on `gig_claims`. Lets the gig poster UPDATE a claim row when `status = 'submitted_for_review'`, restricted to flipping it to `'approved'` (accepted) or `'active'` (sent back for revision). Without this, the client-side `gig_claims.update` from the flipper silently fails — no error, no rows changed, redirect fires anyway. Discovered exactly that way during first end-to-end test.

**Quirks worth knowing**
- "Send back for revision" does NOT release the Stripe authorization. Hold stays in place so the worker can fix and resubmit without forcing a re-pick. Card auths expire after ~7 days though — if the worker takes longer the auth will lapse and a fresh re-pick would be needed.
- There's no "Permanently reject this worker" button. The current reject is "send back." Permanent-reject UI is a future addition; it'd call `stripe.paymentIntents.cancel()` and set `payment_status='canceled'`.
- After the first successful test the flipper-side gig page still showed "Review work" until refresh — turned out the redirect was firing before the page re-rendered with fresh data. The `.select()`/row-count guard added in `FlipperReviewActions.tsx` would now catch a genuine silent-RLS failure, but for stale-cache cases the user just needs to refresh. Not worth a fix unless it gets reported.
- Stripe shows the worker's cut as a Pending transfer until the bank confirms (7-14 days for new Connect accounts). That's normal Stripe behavior, not a bug.

**Verified end-to-end in sandbox**
- Flipper picks → $26.06 hold appears in Stripe ✓
- Worker submits work ✓
- Flipper approves → Stripe captures, payment shows Succeeded ✓
- Worker's `/my-gigs/payouts` shows $24.50 Pending ✓
- Flipper dashboard shows "1 Completed, $25 Paid Out" ✓
- Worker's "My Gigs" History tab shows the gig as Approved ✓


- **Stripe API version pinned to `2024-06-20`** in `lib/stripe.ts`. Don't bump unless you're ready to test breaking changes.
- **All Stripe amounts are in CENTS** — `calculatePaymentBreakdown` returns both cents and dollars. Use cents for Stripe API calls, dollars for display.
- **The 2% platform fee comes OUT OF the gig amount** (worker receives 98% of gig pay). The flipper pays gig + Stripe fees on top, NOT gig + Stripe + platform fee. This is intentional.
- **`payment_status` enum on `payout_records` is the source of truth** for Stripe-tracked payouts. The old `payout_status` column (unpaid/pending/paid) is still there for backwards compat / legacy manual payouts but new gigs should use `payment_status`.
- **Connect was set up via the NEW sandbox style.** When asking Cory to do Stripe dashboard things, send him to `https://dashboard.stripe.com/acct_1TZNIGRrFKq5pWBh/test/...` URLs, not the legacy `/test/...` root.
- **OCR is unreliable for Stripe keys.** Don't trust transcribing keys off screenshots — characters like `l`/`I`/`1` and `O`/`0` are confusable. Always ask Cory to use Stripe's copy button.

---

## DEPRECATED — old manual-PayPal payout planning

⚠️ The whole "polish manual PayPal" plan from the prior session is dead. We pivoted to Stripe Connect (above). The two scoping questions about "money flow" and "which gaps to fix" were answered:
1. Money flow: flipper → platform → worker
2. Gaps: full polish — but via Stripe Connect, not by improving manual PayPal tracking

The legacy `payout_records` columns (`payout_status`, `payout_reference`, `payout_date`) still exist and are still wired to the existing admin/worker payout UIs. They'll get replaced as Phases 5-6 ship. Don't delete the legacy columns until live transactions are running on Stripe.

---

## ⚠️ TODOs left at end of session

1. **Rotate `SIGHTENGINE_API_SECRET`** — exposed in chat in an earlier session. Regenerate in Sightengine dashboard, update Vercel env var, redeploy. STILL OUTSTANDING — Cory has not done this yet across multiple sessions.
2. **Stripe Connect Phase 4+** — Phases 1 (worker onboarding), 2 (flipper saves card), and 3 (authorize on pick) are done. Next is capture-on-approval: when the admin approves submitted work, call `paymentIntents.capture()` on the held PaymentIntent. Stripe auto-transfers gig amount − 2% to the worker's Connect account. See "Stripe Connect payout system" section above for the full phase list.
3. **AI support chat** — DEPRIORITIZED until Stripe payouts are live (the AI needs to be able to answer payout questions accurately). Plan still good — Haiku 4.5, `/support` page, `ANTHROPIC_API_KEY` env var, 5 chats/day per user. See prior handoffs for details.
4. **Place `ReportImageButton` on photo views** — gallery cards, gig photo grids, avatar viewers. Component is built; just needs to be slotted in.
5. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.
6. **Legal/TOS work** — started but didn't finish in a previous session. Decisions already made:
   - Source: generated starter text (lawyer-review-before-launch disclaimer at top)
   - Gate: hard gate — must accept before doing anything
   - Existing infra at `/auth/agreements` already handles multiple required agreements; just needs TOS + Privacy seed and a server-side check that redirects logged-in users with unaccepted required agreements to `/auth/agreements`. A SQL file (`supabase/schema_legal_agreements.sql`) was scaffolded but not completed. Restart fresh.
7. **Apply `force-dynamic` audit to other server pages.** The flipper dashboard and gig detail pages needed `force-dynamic + revalidate=0` to stop showing stale claim data. Worth scanning other server pages that show claim/applicant state (worker `/my-gigs`, `/messages`, etc.) and adding the same if they exhibit similar staleness.
8. **`types/database.ts` is out of sync with several Stripe columns.** Adding the Stripe columns (`users.stripe_customer_id`, `worker_profiles.stripe_*`, `payout_records.payment_status` etc.) would let us remove the `as any` casts sprinkled through all Stripe-touching files.

---

## Key codebase notes (carry-over from previous handoffs)

- **Two photo gallery tables** that the public profile combines: `worker_photo_galleries` and `flipper_photo_galleries`. Work Samples uploader on `/profile` uploads to flipper. Old worker photos still shown on public profile, deletable from `/profile`.
- **`PhotoGallery.tsx`** is the editable gallery component (delete buttons, captions). The public profile uses its OWN inline IG-style grid — don't try to use PhotoGallery there.
- **Photo upload APIs:** `/api/upload-flipper-gallery-photo` and `/api/upload-worker-gallery-photo` use the shared `createClient` from `@/lib/supabase/server` (NOT the manual `createServerClient` pattern — that was a previous bug source).
- **Avatar uploads** use `/api/upload-avatar` (also shared `createClient`), max 5MB. Work Sample photos max 10MB.
- **Nav** lives in `components/shared/Nav.tsx`. Hamburger dropdown has "My Profile" (→ `/u/[username]`), "Account Settings" (→ `/profile`), "Support" (→ `/support`), Logout. Now also has the realtime unread message badge.
- **Middleware** at root protects `/gigs`, `/my-gigs`, `/admin`, `/flipper`, `/profile`, `/messages`, `/auth/agreements`.
- **Worker profile** uses `first_name` + `last_name` (yes — the old handoff said `full_name`; that was WRONG. The schema and code both use first/last. Trust `types/database.ts`.).
- **Cory bumped photo limits from 5MB to 10MB** for Work Samples specifically. Avatars stayed at 5MB.

---

## Watch out for

- **`/profile/worker` and `/profile/flipper` are dead code.** Don't link to them or update them. Use `/profile`.
- **`PublicWorkerProfileClient.tsx` and `PublicFlipperProfileClient.tsx` are dead components.** The new one is `components/profile/PublicProfileClient.tsx`.
- **The "Project Instructions" file in this Claude project is OUT OF DATE.** It references Phase 2 as next. Ignore it. Use this handoff and `MARKETPLACE_ROADMAP.md` in the repo root.
- **Minification trap:** client components with module-level `const` data used in rendering can get stripped in production builds. Keep data inside hooks. (Has bitten previous instances.)
- **Gig schema has BOTH `poster_user_id` AND `created_by`.** `post-gig/PostGigForm.tsx` fills both. App code reads `poster_user_id`. SQL triggers AND new RLS policies use `coalesce(poster_user_id, created_by)` for safety. Use the same pattern if you write new SQL.
- **He's on Max plan.** Use the context you need, but don't be wasteful.
- **Supabase embed-joins fail SILENTLY under RLS.** A query like `.select('*, worker_profiles(...)')` returns the parent row with the embed set to `null` if RLS blocks the join target — no error, no warning. This bit us on the flipper applicant list. If a join returns null unexpectedly, suspect an RLS policy on the embed target table BEFORE blaming the app code. The safer pattern when in doubt: do two separate queries and stitch in JS.
- **When adding a feature that lets ONE role see another role's data, check RLS on EVERY table you query, including joined ones.** RLS is the silent gatekeeper — it's not enough to allow access to the primary table.
- **`force-dynamic` + `revalidate=0` is the cache-buster combo** for server pages that show fast-changing relational data. `/flipper/dashboard` and `/flipper/gigs/[id]` already have it. Add it to any new page that shows claim/applicant/message state.

---

## What's next (next session)

**Payments system is functionally complete for the happy path, but NOT production-ready.** Phases 0-4 ship; Phases 5-9 still needed before going live with real money. See `MARKETPLACE_ROADMAP.md` for the full picture.

Cory's most likely next moves, in rough order:

1. **Stripe webhooks (Phase 7).** Required before going live with real money. Without webhooks we don't get notified when: a transfer to a worker fails, a flipper disputes a charge, an authorization expires before capture (7+ days), a worker's Connect account status changes async. Build `/api/stripe/webhook` to handle at minimum `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `transfer.created`, `transfer.failed`, `charge.refunded`. Needs `STRIPE_WEBHOOK_SECRET` env var on Vercel.

2. **Unified dashboard ("Home" / "Today" view).** Cory raised this at end of session. Current state: info is scattered across the flipper dashboard, My Gigs (Active/Applications/History), Messages, Payouts, and Profile/Payments. With universal profiles, one user can be flipping AND applying simultaneously. He wants a single landing page that shows everything needing attention: gigs awaiting your review (as flipper), new applicants (as flipper), unread messages, work in progress (as worker), recent payouts, quick actions. Sections that have nothing to show should vanish — pure-flippers see flipper stuff, pure-workers see worker stuff, both-roles see both. Don't gate by role check; gate by "is there data for this section."

3. **Stripe Connect Phase 5: Worker payout UI polish.** Show Stripe Express dashboard login link on `/my-gigs/payouts`, show expected payout arrival window, surface Stripe-side status (Pending / In transit / Paid) instead of legacy "unpaid/pending/paid."

4. **Stripe Connect Phase 6: Admin payout UI upgrade.** Show stripe_payment_intent_id, payment_status, capture/refund buttons on the admin payouts page.

5. **Stripe Connect Phase 8: Edge cases.** What happens when: flipper's card declines at capture time, worker's Connect account gets restricted after approval, auth expires before work is done, flipper requests refund after capture, gig is canceled after authorization. Many of these need webhooks (Phase 7) first.

6. **Stripe Connect Phase 9: Go-live.** Swap test keys → live keys, one real $1 transaction to verify, monitor.

7. **Dashboard discoverability micro-fix (if not doing #2 yet).** The current flipper dashboard has no signal for "work submitted, awaiting your review." The "Pending applicants" tile only counts pending claims (waiting-to-be-picked). Submitted-for-review claims have no banner or tile. Phase 4 surfaced this — solved at the gig-detail level (top section + Review work button) but not at the dashboard level. Add a tile + banner counting gigs with any `submitted_for_review` claim.

8. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.

9. **Rotate `SIGHTENGINE_API_SECRET`** — overdue across multiple sessions.

10. **Place `ReportImageButton`** on photo views.

11. **Terms of Service + privacy policy.**

12. **Address/pickup details on gigs.**

13. **Email notifications.**

14. **Ratings/reviews.**

15. **"Payouts" nav link is worker-centric.** Currently shown to everyone; flippers hitting it see "$0 earnings" empty state. Either rename it, hide it for users with no payout history, or build a paired flipper-side "Payments you've made" view. Low priority — Cory was aware and laughed it off, but worth fixing eventually.

Cory will pick. Open by confirming what you're about to build in 2-3 lines, then build.

---

## This session's commits (most recent first)

- `b6d74c8` Stripe Connect Phase 4: RLS fix + silent-failure guards
- `85e0ec4` Stripe Connect Phase 4: flipper-side review page (not admin)
- `922d3f1` Stripe Connect Phase 4: capture on approval

## Previous session's commits

- `b96b05a` Stripe Connect Phase 3: RLS fix - flippers can INSERT/UPDATE their own payout_records
- `e39d4b0` Stripe Connect Phase 3: wire ApplicantActions to /api/stripe/pick-worker + 3DS handling
- `12b9ad6` Stripe Connect Phase 3: pick-worker API route (authorize on pick)
- `b61a85c` Stripe Connect Phase 3: authorizePickPayment helper
- `fd9c564` Stripe Connect Phase 3: SQL for flipper RLS + flipper_user_id index

## Older commits

- `7a18b0a` Flipper dashboard: needs-review banner, pending stat, filters, sort
- `c236885` Fix: card-save modal didn't fit smaller screens
- `2080d1f` Fix: flipper applicant list — split join into two queries + disable caching
- `c26cee0` Fix part 2: posters couldn't see applicant worker_profiles (RLS)
- `cdb6fbf` Fix: flippers couldn't see applicants on their own gigs (RLS bug)
- `dd54c2a` Stripe Connect Phase 2: flipper saves card before picking a worker
- `c4d9e37` Stripe Connect Phase 1: worker onboarding flow + apply-gating
- `bb38180` Update HANDOFF: Stripe Connect foundation shipped, payout pivot documented
- `62c9a78` Stripe Connect foundation: SDK install, client helper, SQL migration, health route

---

Good luck. Cory is sharp, patient, and direct. Match that energy.
