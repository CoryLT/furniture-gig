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
- Post a gig, edit a gig, browse gigs (with city/state filter; **own posted gigs ARE included** in the browse feed with a "Your post" badge — Cory wants to see what workers see)
- Claim a gig (exclusive — DB unique constraint; **users can't claim their own gigs**, enforced at UI + DB level)
- **Reference images visible everywhere they should be:** the worker browse cards show a thumbnail of the first reference image; the flipper's My Posted Gigs list (`/flipper/dashboard`) shows a 64px square thumbnail; the worker gig detail page AND the flipper gig detail page (`/flipper/gigs/[id]`) both render the full reference image grid via the shared `GigReferenceImages` component.
- "My Gigs" workflow: checklist + photo uploads + submit for review
- Admin review flow at `/admin`
- Payouts tracking (manual PayPal, admin updates status)
- Work Samples photo gallery on profile
- **Marketplace at `/marketplace`** — public feed of items for sale (parallel to the gig system, NOT mixed in). Post a listing, edit, mark sold/hide/delete. See "Marketplace" section below.
- **Marketplace is the FRONT DOOR.** `/` redirects to `/marketplace` for everyone (logged in or out). Logo points to `/marketplace`. Post-auth landing is `/marketplace`, not `/home`. See "Marketplace as front door" section.
- **Messaging — TWO kinds**: gig conversations (`gig_conversations`/`gig_messages`) and listing conversations (`listing_conversations`/`listing_messages`). Inbox at `/messages` unions both. Chat page at `/messages/[conversationId]` dispatches by type. Nav unread badge counts unread from both. See "Messaging system" below.
- **Application/approval flow** — workers apply, flipper picks one (replaced old "first-to-claim wins" model)
- **Image moderation via Sightengine** — all uploads (gig photos, gig images, avatars, gallery photos, marketplace photos) blocked for porn / violence / weapons / drugs / gore / offensive / minors
- **User-reported image flagging** — backend API exists but Report button isn't placed on photo views yet
- **User-reported listing flagging** — `listing_reports` table exists from this session's SQL; no Report button or admin queue built yet
- **Stripe Connect — workers connect** (Phase 1): workers must connect a Stripe Express account before applying; gated apply button on gig detail
- **Stripe Connect — flippers save a card** (Phase 2): when flipper clicks "Pick this worker," a modal collects a card via Stripe Elements (SetupIntent + Customer). Saved off-session for Phase 3 authorize-on-pick.
- **Stripe Connect — authorize on pick** (Phase 3): when flipper picks a worker, a PaymentIntent holds money on their card (`capture_method: manual`). Worker's Connect account is set as `transfer_data.destination`. Platform fee = 2% via `application_fee_amount`.
- **Stripe Connect — capture on approval** (Phase 4): flipper-side review at `/flipper/review/[claimId]`. When flipper approves submitted work, the held PaymentIntent is captured. Stripe auto-transfers (gig amount − 2%) to the worker's Connect account. Verified end-to-end in sandbox.
- **Stripe Connect — webhooks** (Phase 7): `/api/stripe/webhook` is live. Receiver verifies Stripe signature, logs every event to `stripe_webhook_events` (idempotent via event ID PK), dispatches 8 event types (`account.updated`, `payment_intent.succeeded/payment_failed/canceled`, `transfer.created/reversed`, `charge.refunded/dispute.created`). Each handler is idempotent and won't move a payout row backwards in its status lifecycle. Always returns 200 unless signature fails — handler errors are logged on the event row but don't ask Stripe to retry (avoids infinite-loop on deterministic bugs). The Stripe dashboard side is configured with ONE event destination scoped to "Connected accounts" (not two — both platform and connected events flow through the same endpoint despite Stripe's UI suggesting otherwise; `transfer.failed` is deprecated, use `transfer.reversed`).
- **Unified Dashboard at `/home`** — still exists as a personalized dashboard reachable from the hamburger nav, but is NO LONGER the post-auth landing page (marketplace is). Greeting + date, 4-tile hero stats (total earned / invested / gigs completed / active), 30-day stacked-bar SVG chart of daily money flow (hand-rolled, no chart deps), action sections that hide when empty (needs review / pending applicants / unread messages / work in progress), "You vs the community" percentile bars (only shows once user has some activity), recent activity feed (last ~10 events). Brand-new users see a single welcome card instead. Hamburger nav collapses ALL primary nav items into the dropdown on every viewport — there's no desktop horizontal link row.
- **Flipper dashboard with filter/sort + needs-review highlights** — banner appears when any gig has pending applicants, dedicated stat tile, filter chips (All / Needs review / Open / In progress / Completed), sort dropdown (Newest / Oldest / Due soon / Most applicants), pending gigs always float to top under "All". Note: does NOT yet surface "work submitted, awaiting your review" — that's a known gap (see What's Next).

---

## Messaging system

There are TWO kinds of conversations, on parallel table sets, unified in the UI:
- **Gig conversations** — one per (gig, applicant). `gig_conversations` + `gig_messages`.
- **Listing conversations** — one per (marketplace listing, buyer). `listing_conversations` + `listing_messages`.

The inbox at `/messages` queries both, merges, sorts by `last_message_at`. The chat page at `/messages/[conversationId]` looks up the ID in both tables and dispatches. The Nav unread badge subscribes to BOTH messages tables.

### What's there
- **`/messages` inbox** — unified list across gig + listing conversations, sorted by recency, with unread badges per row and a total unread summary up top
- **`/messages/[conversationId]` chat page** — message bubbles, type-and-send composer, realtime delivery, "is typing" indicator (bouncing dots), read receipts ("Sent" / "Seen"). Dispatches by conversation kind. Header shows "About gig: …" or "About listing: …" with a link to the source.
- **"Message Flipper" button** on worker's My-Gig detail page (`/my-gigs/[claimId]`)
- **"Message Worker" button** on each active claim in flipper's gig page (`/flipper/gigs/[id]`)
- **"Message Seller" button** on marketplace listing detail (`/marketplace/[slug]`) for any logged-in non-owner
- **Realtime unread badge** in the top nav — ticks up when new messages arrive on either table on ANY page (not just the inbox), ticks back down when read
- **"Messages" link** in top nav hamburger

### Key DB tables (all already run)

In `supabase/schema_messaging.sql`, `schema_messaging_patch_poster.sql`, and `schema_application_flow.sql`:
- `gig_conversations` — one row per (gig, worker) — `UNIQUE(gig_id, worker_user_id)`. Stores `flipper_user_id`, `worker_user_id`, `last_message_at`. RLS allows only the two participants to read/insert/update.
- `gig_messages` — actual messages. Stores `conversation_id`, `sender_user_id`, `body`, `read_at`, `created_at`. RLS: participants can SELECT and INSERT; recipients can UPDATE read_at on messages they did NOT send.
- A trigger on `gig_claims` INSERT auto-creates the conversation when status is `pending` OR `active`. Uses `coalesce(poster_user_id, created_by)` for the flipper.
- A trigger on `gig_messages` INSERT bumps `last_message_at` on the parent conversation.
- Both tables added to `supabase_realtime` publication for client subscriptions.

In `supabase/schema_marketplace_messaging.sql` (and `schema_marketplace_messaging_idempotent.sql` which is the safe-to-rerun copy):
- `listing_conversations` — one row per (listing, buyer) — `UNIQUE(listing_id, buyer_user_id)`. Stores `seller_user_id`, `buyer_user_id`, `last_message_at`. RLS allows only the two participants to read/insert/update, with a check that `seller_user_id <> buyer_user_id`.
- `listing_messages` — same shape as `gig_messages` but parented to `listing_conversations`. Same RLS pattern.
- NO trigger auto-creates the conversation — the buyer creates it explicitly by clicking "Message Seller" (no implicit application step like gigs have).
- A trigger on `listing_messages` INSERT bumps `last_message_at` on the parent.
- Both tables added to `supabase_realtime` publication.

### Key code files
- `app/messages/layout.tsx` — auth + Nav wrapper, looks up username from worker OR flipper profile.
- `app/messages/page.tsx` — inbox (server component). Queries BOTH `gig_conversations` and `listing_conversations`, fetches messages from BOTH tables, merges + sorts in JS, computes preview + unread per conversation.
- `app/messages/[conversationId]/page.tsx` — chat page (server). Tries `gig_conversations` first, falls back to `listing_conversations`. Dispatches to `renderGigConversation` or `renderListingConversation`. Both branches pass uniform props (including a `contextLabel` + `contextTitle` + `contextHref`) to `ChatClient`.
- `app/messages/[conversationId]/ChatClient.tsx` — the actual realtime chat (client). Takes a `conversationKind: 'gig' | 'listing'` prop which decides the messages table name and the realtime channel name. Subscribes via `supabase.channel(\`${kind}-conversation:${conversationId}\`)` to Postgres INSERT/UPDATE events on the right table AND broadcast `typing`/`stop_typing` events.
- `components/shared/OpenChatButton.tsx` — reusable "Message" button for GIG conversations. POSTs to `/api/messages/start`.
- `components/shared/MessageSellerButton.tsx` — analogous button for LISTING conversations. POSTs to `/api/listing-messages/start`.
- `app/api/messages/start/route.ts` — find-or-create gig conversation by `gigId` (+ optional `workerUserId` when caller is the flipper). Validates the caller is a participant.
- `app/api/listing-messages/start/route.ts` — find-or-create listing conversation by `listingId`. Refuses if caller is the seller (sellers don't initiate; they get pinged when a buyer messages them). Refuses if the listing is in `hidden` or `deleted` state.
- `components/shared/Nav.tsx` — has the realtime unread badge logic. Subscribes to INSERT/UPDATE events on BOTH `gig_messages` AND `listing_messages`. RLS already restricts events to visible ones.

### Quirks worth knowing
- The chat client uses **optimistic UI** — when you send a message, it appears immediately as `pending`, then the realtime INSERT replaces it. There's merge logic to avoid duplicate rendering.
- The typing indicator throttles broadcasts to once per 1.5s. Stops broadcasting on blur or empty input.
- The unread badge in Nav has TWO triggers: (1) realtime subscription to inserts/updates on both tables, and (2) a 1.2s delayed refetch (against both tables) when the user navigates to anything under `/messages` (to catch read_at updates that may be in flight). Both work in tandem.
- The chat page header avatar/name links to `/u/[username]` if a username exists — handy for flippers vetting workers, or buyers/sellers vetting each other.
- The two table sets are deliberately separate (not unified into one with a `kind` column). Rationale (also in the SQL file header): gig messaging is well-tested, RLS rules differ (listing conversations can be created by anyone non-seller without a claim row), uniqueness constraints differ, and the union-in-code pattern keeps both safer.
- Conversation IDs are UUIDs and globally unique enough that a collision between `gig_conversations.id` and `listing_conversations.id` is effectively impossible. The chat page's "try gig first, then listing" dispatch is safe.


---

## Stripe Connect Phase 7: webhooks (DONE — shipped a previous session)

### What's there
- **`/api/stripe/webhook`** — POST endpoint that Stripe pings. Verifies signature with `STRIPE_WEBHOOK_SECRET`, inserts a row in `stripe_webhook_events` using event ID as PK (idempotency — duplicate deliveries 200-no-op), dispatches by event type, marks row processed/ignored/error.
- **`lib/stripe-webhook-handlers.ts`** — one handler per event type. All idempotent (won't move payout rows backward in their status lifecycle).
- **`stripe_webhook_events` table** — full audit log, payload stored as JSONB, admin-only RLS SELECT.

### Event types handled
- `account.updated` — syncs `worker_profiles.stripe_charges_enabled / stripe_payouts_enabled / stripe_details_submitted` and stamps `stripe_onboarding_completed_at` first time all are green.
- `payment_intent.succeeded` — belt-and-suspenders for capture. The sync capture-on-approval API already writes to DB, but if that write failed and Stripe captured anyway, this catches up.
- `payment_intent.payment_failed` — flips payout row to `payment_status='failed'` with the Stripe error in `notes`.
- `payment_intent.canceled` — flips to `'canceled'` UNLESS the row is already in `captured`/`transferred`/`refunded` (defensive).
- `transfer.created` — flips to `'transferred'`, stores `stripe_transfer_id`.
- `transfer.reversed` — flips to `'failed'` with reason in `notes`. (NOTE: `transfer.failed` was deprecated by Stripe; use `transfer.reversed`.)
- `charge.refunded` — flips to `'refunded'`, also rolls legacy `payout_status` back to `'unpaid'`, appends refund note.
- `charge.dispute.created` — does NOT change status (a dispute can be won), just appends a ⚠️ note. Full dispute handling is a Phase 8 task.

### Stripe dashboard setup (already done)
- ONE event destination: "FlipWork — Connected accounts" → `https://myflipwork.com/api/stripe/webhook`
- Scope: **Connected accounts** (not "Your account"). All 8 events route through this one destination despite Stripe's UI implying you need a separate destination for platform-scoped events. This works because in test mode the platform events flow through here too, and there's no benefit to splitting them.
- Signing secret in Vercel as `STRIPE_WEBHOOK_SECRET` (rolled mid-session because it was screenshotted).
- **For LIVE mode (Phase 9)**: you'll need a SEPARATE destination created in Live mode in Stripe, with its own `whsec_...`. Either swap the env var or add a second one if you want to test alongside live for a bit.

### Key code files
- `app/api/stripe/webhook/route.ts` — receiver. Uses `runtime = 'nodejs'` (raw body for signature verify). Always returns 200 except 400 on signature failure — deliberate, to prevent Stripe retry storms on deterministic bugs.
- `lib/stripe-webhook-handlers.ts` — 8 handler functions, each takes `(event, supabaseAdminClient)` and returns a status string for logging.
- `lib/supabase/admin.ts` — service-role client (pre-existed, used by the webhook).
- `supabase/schema_phase7_stripe_webhooks.sql` — already run.
- `PHASE_7_SETUP.md` — setup walkthrough for Cory (SQL + Stripe + Vercel steps).

### Quirks worth knowing
- The `switch` statement on `event.type` uses `(event.type as string)` cast because Stripe's TS literal union doesn't include all valid runtime event types.
- The "error" status on `stripe_webhook_events` stores the actual handler error message in `error_message`. The "processed" rows reuse `error_message` to store the handler's status message — a small hack documented in the route.

---

## Unified Dashboard at `/home` (DONE — shipped a previous session; superseded as landing by /marketplace)

### What's there
- **`/home`** is the personalized dashboard for logged-in users. **No longer the auto-landing after auth** (that's `/marketplace` now), but still accessible from the hamburger nav ("Dashboard" link) and still protected by middleware.
- **`/` (root)** now redirects everyone (logged in or out) to `/marketplace`. The original "logged-in → /home, logged-out → marketing landing" logic is gone.
- **Logo** points to `/marketplace` for workers/flippers, `/admin` for admins. (Previously pointed at `/home`.)
- **Hamburger nav** structure unchanged from when it shipped: NO horizontal link row; all primary items collapsed into the dropdown on every viewport. The "Dashboard" item in the dropdown is the way users now reach `/home`.

### Sections on the page (server-rendered)
1. Greeting ("Good morning, [first name]") + today's date
2. **4 hero stat tiles**: Total earned (lifetime $) · Total invested · Gigs completed (worker + flipper combined) · Active right now
3. **30-day stacked-bar SVG chart** of daily money flow. Orange = earned, blue = invested. Empty days render as a thin baseline tick. Tooltip on hover.
4. **Action sections (each hides if empty)**: needs review · pending applicants · unread messages · work in progress
5. **"You vs the community"**: percentile bars — only shows if user has at least some activity
6. **Recent activity feed**: last ~10 events, computed inline by querying claims/payouts/gigs and sorting by time
7. **Quick actions** at the bottom: Post a gig · Browse gigs

### Brand-new user case
If user has zero of everything (no payouts, no claims, no posted gigs, no activity), they see ONE welcome card with "Post your first gig" and "Browse open gigs" CTAs instead of all the above.

### Key code files
- `app/home/page.tsx` — the main page, ~600 lines, server component. Does all data fetching inline (lots of small Supabase queries — could be optimized later if perf becomes an issue).
- `components/home/ActivityChart.tsx` — hand-rolled SVG client component (no chart library). Renders the 30-day bar chart with hover tooltip.
- `lib/home-dashboard.ts` — small helpers (`lastNDays`, `toISODate`, `buildBuckets`) for date bucketing.
- `app/page.tsx` — root. Just redirects to `/marketplace`. (Used to redirect logged-in users to `/home`; that logic moved to favor marketplace.)

### Deliberately NOT done
- **Streak counter** — Cory deferred. Requires a new `user_activity_log` table with triggers. Currently the closest thing to a streak is the 30-day chart. Adding streaks is still the next obvious dashboard enhancement.
- The "Recent activity" feed currently queries existing tables; with an activity log table it'd be richer and faster.

### Quirks worth knowing
- The percentile section ("outearned X% of workers") is a real calculation, but with only a handful of users it'll often hit 0% or 100%. Looks weird in dev; gets better as user base grows.
- The chart uses LOCAL timezone for date bucketing (see `toISODate` in `lib/home-dashboard.ts`). If users are spread across timezones, "today" is per-user.
- **Auth path destinations changed.** When `/home` first shipped, every login redirect path was updated to land there. This session, all those paths were updated AGAIN to land on `/marketplace` (with `?next=` preserved if present). If you add a new auth method, send users to `/marketplace`, not `/home`. The full list of touched files is in the "Marketplace as front door" section.

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

### 4. Logo links to /marketplace for non-admins (CURRENT — superseded prior `/gigs` and `/home` versions)
The FlipWork logo's `logoHref` has been through three iterations as the site's front door has evolved. It currently points to `/marketplace` for workers/flippers and `/admin` for admins. The relevant line in `components/shared/Nav.tsx`:
```ts
const logoHref = role === 'admin' ? '/admin' : '/marketplace'
```
Logos on auth pages (login, signup) still point to `/` — that's correct since `/` itself redirects to `/marketplace` now anyway.

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

## Marketplace (DONE — foundation + posting flow + messaging shipped across recent sessions)

A parallel system to the gig flow, for buying/selling furniture. The two systems share auth/profiles but otherwise live side-by-side — they don't mix.

### The flow
1. Anyone can browse `/marketplace` (public feed, no auth required)
2. Logged-in users post listings at `/marketplace/new` (with photos)
3. Logged-in users edit/manage their own listings at `/marketplace/mine`
4. Logged-in users (non-sellers) message a seller via the "Message Seller" button on the listing detail page
5. Listings have status `active` / `sold` / `hidden` / `deleted`. Hidden/deleted are excluded from feed and from listing detail. Sold listings stay visible (with a SOLD badge) for credibility.

### Schema (all already run)
- `supabase/schema_marketplace.sql` — foundation. Tables: `marketplace_listings`, `marketplace_photos`, `marketplace_categories` (seeded). Plus a saved-search infrastructure that's not yet surfaced in UI. Full RLS.
- `supabase/schema_marketplace_messaging.sql` (original) and `schema_marketplace_messaging_idempotent.sql` (safe-to-rerun copy used after a partial run failed mid-way) — adds `listing_conversations`, `listing_messages`, `listing_reports`. The idempotent version uses `drop policy if exists` before every `create policy` and is the one to use going forward.

### Key code files
- **Public feed**
  - `app/marketplace/page.tsx` + `MarketplaceFeed.tsx` + `ListingCard.tsx` — the grid feed with filtering
  - `app/marketplace/[slug]/page.tsx` + `PhotoCarousel.tsx` — listing detail
- **Posting / editing**
  - `app/marketplace/new/page.tsx` + `NewListingForm.tsx`
  - `app/marketplace/[slug]/edit/page.tsx` + `EditListingForm.tsx`
  - `app/marketplace/mine/page.tsx` + `MyListingsList.tsx`
- **Photo upload (with image moderation gate, matching the gig pattern)**
  - `app/api/upload-marketplace-photo/route.ts` — calls Sightengine via `moderateImage()` before upload; mirrors `/api/upload-gig-image` exactly. Storage bucket: `marketplace-photos`.
- **Listing state changes**
  - `app/api/marketplace/[id]/sold/route.ts`, `.../hide/route.ts`, `.../reactivate/route.ts`, `.../delete/route.ts`, `.../update/route.ts` — narrow endpoints, each verifies ownership before mutating.
- **Validation**
  - `lib/marketplace-validation.ts` — shared validation rules used by both create and update endpoints.
- **Messaging** — see "Messaging system" section above (`MessageSellerButton`, `/api/listing-messages/start`).

### Quirks worth knowing
- **Two photo path conventions exist.** `marketplace_photos.file_path` stores just the path within the bucket (e.g. `<listing-id>/<timestamp>.jpg`). Always call `supabase.storage.from('marketplace-photos').getPublicUrl(file_path)` to render.
- **Slugs** are auto-generated from the title + a short hash so duplicates don't collide. Listing URLs are `/marketplace/<slug>` not by ID.
- **`price_mode`** is either `'fixed'` (use `price_cents`) or `'free'` (`price_cents = 0`, but `formatPriceFromCents` returns "Free"). New code that touches price must respect both modes.
- **No transaction/escrow.** Unlike gigs, marketplace doesn't use Stripe — buyer and seller arrange the deal in DMs and meet up. This is intentional for v1.
- **No reviews/ratings.** Same as gigs — Bucket 1 #4 in MARKETPLACE_ROADMAP.md.
- **The `listing_reports` table exists from this session's SQL** but no Report button is placed on listings yet, and there's no admin queue page for it. Parallel to the long-standing `image_reports` TODO.
- **Listing photo uploads ARE moderated** (the route already calls `moderateImage()` and `logModerationCheck()` with `uploadSource: 'marketplace_photo'`). One less thing to wire — was already done by whoever built Marketplace Session 2.

---

## Marketplace as front door (DONE — shipped a previous session)

Originally `/home` was the post-auth landing for logged-in users and `/` was a marketing landing page for logged-out users. Cory wanted the marketplace front-and-center for everyone, with the dashboard demoted to "available via the hamburger nav but not a destination."

### What changed
- **`/` redirects to `/marketplace` for everyone**, logged in or out. The marketing-landing version of `app/page.tsx` is gone. (`/home` is still accessible if you navigate there directly or click "Dashboard" in the hamburger.)
- **Logo links to `/marketplace`** for workers/flippers. Admin logo still links to `/admin`.
- **Post-auth lands on `/marketplace`** by default. Every login/signup path updated: `app/auth/login/page.tsx`, `app/auth/login/actions.ts` (dead code but kept consistent), `app/api/auth/set-session/route.ts` (Google OAuth), `app/auth/agreements/page.tsx` (`homeForRole` helper).
- **`?next=` is preserved through every auth path.** If a user lands on `/auth/login` or `/auth/signup` with `?next=/marketplace/<slug>`, that path survives:
  - login form → either branch respects `?next=` (with safety checks)
  - signup → onboarding → agreements (each forwards `?next=`)
  - Google OAuth: signup/login encodes `?next=` into the `redirectTo` URL going TO Google. `/auth/finishing` reads it back from `window.location.search` and POSTs it to `/api/auth/set-session`. `set-session` validates and uses it as the destination.
- **Middleware bounces to login WITH `?next=`.** Any protected-route hit without a session now redirects to `/auth/login?next=<original-path>` so the user lands back on their original destination after auth. (Previously, the original destination was lost.)

### Safety rules baked into every `safeNext` check
- Must start with `/` (no external URLs)
- Must NOT start with `/auth` (would loop)
- Must NOT start with `/admin` (workers/flippers can't be redirected into admin-only pages)
- Admin login does the inverse: `?next=` only honored if it points at `/admin`.

### Key files touched
- `app/page.tsx` — root, just redirects
- `app/auth/login/page.tsx` — reads `?next=`, honors it for both email and Google login
- `app/auth/signup/page.tsx` — reads `?next=`, forwards to onboarding via query param; reciprocal sign-in link carries `?next=` too
- `app/auth/onboarding/page.tsx` — reads `?next=`, forwards to agreements
- `app/auth/agreements/page.tsx` — already honored `?next=`; just changed default fallback to `/marketplace`
- `app/auth/finishing/page.tsx` — reads `?next=` from `window.location.search`, passes through `/api/auth/set-session` body
- `app/api/auth/set-session/route.ts` — accepts `next` in body, validates as safe, swaps both `'/home'` defaults to `postAuthDestination`
- `app/api/auth/login/actions.ts` (dead code) — kept consistent
- `components/shared/Nav.tsx` — `logoHref` changed for non-admins
- `middleware.ts` — bounce-to-login includes `?next=<original-path>`

### Quirks worth knowing
- **`/home` still exists** and is intentionally still in the protected-routes list in `middleware.ts`. The "Dashboard" link in the hamburger nav still points there. Just no path leads there automatically anymore. If you delete `/home`, audit the nav link.
- **The flipper-specific dashboard at `/flipper/dashboard`** is unchanged — it's still its own page, reachable via the "My Posted Gigs" hamburger link.
- **Verified end-to-end** by Cory after deploy: logo, post-auth landing, listing → signup → land back on listing.

---

## DEPRECATED — old manual-PayPal payout planning

⚠️ The whole "polish manual PayPal" plan from the prior session is dead. We pivoted to Stripe Connect (above). The two scoping questions about "money flow" and "which gaps to fix" were answered:
1. Money flow: flipper → platform → worker
2. Gaps: full polish — but via Stripe Connect, not by improving manual PayPal tracking

The legacy `payout_records` columns (`payout_status`, `payout_reference`, `payout_date`) still exist and are still wired to the existing admin/worker payout UIs. They'll get replaced as Phases 5-6 ship. Don't delete the legacy columns until live transactions are running on Stripe.

---

## ⚠️ TODOs left at end of session

1. **Rotate `SIGHTENGINE_API_SECRET`** — exposed in chat in an earlier session. Regenerate in Sightengine dashboard, update Vercel env var, redeploy. STILL OUTSTANDING — Cory has not done this yet across multiple sessions.
2. **Stripe Connect Phases 5, 6, 8, 9** — Phases 1-4 + 7 are done. Still needed before going live:
   - Phase 5: worker payout UI polish (Express dashboard login link, arrival window, Stripe-side status)
   - Phase 6: admin payout UI upgrade (show PI ID, status, refund button)
   - Phase 8: edge cases (declined cards at capture, restricted Connect accounts, expired auths, post-capture refunds)
   - Phase 9: go-live (swap to live keys, new webhook destination in live mode, $1 real-money smoke test)
3. **AI support chat** — DEPRIORITIZED until Stripe payouts are live (the AI needs to be able to answer payout questions accurately). Plan still good — Haiku 4.5, `/support` page, `ANTHROPIC_API_KEY` env var, 5 chats/day per user. See prior handoffs for details.
4. **Place `ReportImageButton` on photo views** — gallery cards, gig photo grids, avatar viewers. Component is built; just needs to be slotted in.
5. **Listing reports — Report button + admin queue.** `listing_reports` table exists from this session's SQL. Need a "Report listing" button on the marketplace listing detail page, a `/api/report-listing` endpoint, and an admin queue page at something like `/admin/listing-reports`. Parallel to the existing `image_reports` infrastructure — should copy that pattern.
6. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.
7. **Legal/TOS work** — started but didn't finish in a previous session. Decisions already made:
   - Source: generated starter text (lawyer-review-before-launch disclaimer at top)
   - Gate: hard gate — must accept before doing anything
   - Existing infra at `/auth/agreements` already handles multiple required agreements; just needs TOS + Privacy seed and a server-side check that redirects logged-in users with unaccepted required agreements to `/auth/agreements`. A SQL file (`supabase/schema_legal_agreements.sql`) was scaffolded but not completed. Restart fresh.
8. **Email notifications** (Bucket 1 #1 in MARKETPLACE_ROADMAP.md). Right now if someone applies to your gig, messages you on a listing, or buys/sells something, they have to log in and notice. Needs an email provider (Resend / Postmark / SES) and templated sends for the key events.
9. **Address/pickup details on gigs** (Bucket 1 #3). Gigs only have city/state. Want full address visible to picked worker only. Schema change + reveal-after-pick UI.
10. **Apply `force-dynamic` audit to other server pages.** The flipper dashboard, gig detail pages, AND `/my-gigs` (added this session) all have `force-dynamic + revalidate=0` now. Still worth scanning other server pages that show claim/applicant/message state (`/messages`, `/messages/[id]`, `/home`, etc.) and adding the same if they exhibit similar staleness.
11. **`types/database.ts` is out of sync** with several Stripe columns AND the new `listing_conversations`/`listing_messages`/`listing_reports` tables. Adding all of them would let us remove the `as any` casts sprinkled through all Stripe-touching AND listing-messaging files.
12. **Mutual cancel flow for gigs (and tighten hard delete).** ⚠️ Known safety hole as of this session: the new `/api/gigs/[id]/delete` blocks delete on gigs where Stripe money has moved, but it does NOT block delete on gigs that have a claimed/active/pending worker without payment yet. Cory test-deleted a claimed gig and that's how this came up. He paused building the fix and wants it on the list.

    Discussed and decided plan:
    - Build a **mutual cancel** flow modeled after Upwork/TaskRabbit. Either flipper or worker can request to cancel a gig. The other side accepts or declines via a system message in the existing chat thread. On accept: claim flips to a new status (e.g. `cancelled_by_mutual_agreement`), Stripe authorization is released if one is held, gig goes back to `open` (or archived — flipper picks during request).
    - Once mutual cancel completes, hard delete is allowed again on that gig.
    - **Tighten the delete endpoint at the same time:** block hard delete when any claim row exists in `pending`, `active`, or `submitted_for_review` (Upwork/TaskRabbit pattern, "yes — block delete if ANY claim exists" was Cory's directional lean before pausing). Archive remains available in those cases.
    - Touches: `gig_claims` (new status value + maybe a `cancel_requested_by` column), new endpoints `/api/gigs/[id]/cancel/request`, `/api/gigs/[id]/cancel/respond`, UI on both `/my-gigs/[claimId]` and `/flipper/gigs/[id]`, system message into the existing `gig_messages` table, Stripe authorization-release helper (already exists as `cancelPickAuthorization` in `lib/stripe-pick.ts`).
    - Reference: see the conversation that pitched this (industry comparison + flow sketch) for context. ~60-90 min build per the discussion.

---

## Key codebase notes (carry-over from previous handoffs)

- **Two photo gallery tables** that the public profile combines: `worker_photo_galleries` and `flipper_photo_galleries`. Work Samples uploader on `/profile` uploads to flipper. Old worker photos still shown on public profile, deletable from `/profile`.
- **`PhotoGallery.tsx`** is the editable gallery component (delete buttons, captions). The public profile uses its OWN inline IG-style grid — don't try to use PhotoGallery there.
- **Photo upload APIs:** `/api/upload-flipper-gallery-photo` and `/api/upload-worker-gallery-photo` use the shared `createClient` from `@/lib/supabase/server` (NOT the manual `createServerClient` pattern — that was a previous bug source).
- **Avatar uploads** use `/api/upload-avatar` (also shared `createClient`), max 5MB. Work Sample photos max 10MB.
- **Nav** lives in `components/shared/Nav.tsx`. Hamburger dropdown has "My Profile" (→ `/u/[username]`), "Account Settings" (→ `/profile`), "Support" (→ `/support`), Logout. Now also has the realtime unread message badge.
- **Middleware** at root protects `/gigs`, `/my-gigs`, `/admin`, `/flipper`, `/profile`, `/messages`, `/home`, `/auth/agreements`.
- **Worker profile** uses `first_name` + `last_name` (yes — the old handoff said `full_name`; that was WRONG. The schema and code both use first/last. Trust `types/database.ts`.).
- **Cory bumped photo limits from 5MB to 10MB** for Work Samples specifically. Avatars stayed at 5MB.
- **Login redirects now ALL converge on `/marketplace`** for non-admin users, with `?next=` honored when present. Multiple paths updated across two sessions to get here. See the "Marketplace as front door" section for the full file list. If you add a new login or sign-in flow, send users to `/marketplace` by default and honor `?next=` if it's a safe internal path.
- **Nav UI got compacted this session.** No more desktop horizontal link row. ALL primary nav items live inside the hamburger dropdown on every viewport. The unread-message badge is now anchored to the hamburger button itself for at-a-glance visibility. The old standalone `menuOpen` mobile slide-down was deleted (the single dropdown handles both desktop and mobile). The dropdown nav order is: Dashboard, Browse Gigs, My Gigs, Post a Gig, My Posted Gigs, Messages, Payouts, then a divider, then My Profile / Account Settings / Support / Logout.

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
- **`force-dynamic` + `revalidate=0` is the cache-buster combo** for server pages that show fast-changing relational data. `/flipper/dashboard`, `/flipper/gigs/[id]`, and `/home` already have it. Add it to any new page that shows claim/applicant/message state.
- **The `/home` dashboard URL is intentionally NOT `/dashboard`.** It's labeled "Dashboard" in the nav, but the route stayed at `/home` to avoid breaking bookmarks/in-app links. If you decide to rename the route, do an audit of every redirect target (see the multiple login paths note above).
- **`transfer.failed` doesn't exist as a Stripe webhook event anymore.** Stripe deprecated it. The replacement is `transfer.reversed`. The Phase 7 handler is named `handleTransferReversed`. Don't get confused by older docs/references.
- **The webhook route always returns 200** except when signature verification fails (then 400). Handler errors are logged to `stripe_webhook_events.error_message` and `status='error'` but we deliberately don't 500. That's because Stripe will infinite-retry on 5xx and a deterministic crash would amplify the bug. Admins can manually replay events from the Stripe dashboard if needed.
- **The 'You vs community' section on `/home` has a small-N caveat.** With only a handful of users, percentiles will hit 0% or 100% with little in between. It's wired up correctly; it just gets more interesting once there are more users. Not a bug.
- **The 30-day chart on `/home`** is a hand-rolled SVG component (`components/home/ActivityChart.tsx`). No Recharts/chart.js dependency. If you need to extend the chart, just edit the SVG directly — easier than learning a chart lib's API.
- **`/home` is NO LONGER the post-auth landing.** `/marketplace` is. `/home` still works, still in the protected-routes list, still in the hamburger nav as "Dashboard." Just no auth path leads there automatically. If you add a new auth flow, send users to `/marketplace`, not `/home`.
- **`?next=` chain is fragile across the auth pipeline.** It has to be carried by: login form, signup form, signup→onboarding, onboarding→agreements, agreements→destination, Google OAuth (encoded into `redirectTo`, read back from `window.location.search` on `/auth/finishing`, posted to set-session). If you change ANY of these, test the whole chain end-to-end. Always validate that `next` (a) starts with `/`, (b) doesn't start with `/auth` (loop), and (c) for non-admin users doesn't start with `/admin`.
- **Marketplace and gigs share auth/profiles but otherwise live separately.** Don't try to "unify" them at the schema layer (separate tables: `marketplace_listings` vs `gigs`, `listing_conversations` vs `gig_conversations`, etc.). The intentional design is parallel systems with a unified UI on top. The messaging code in particular benefits from this — it would have been MUCH worse to add a `kind` column to `gig_conversations` rather than introducing `listing_conversations`.
- **The marketplace messaging SQL filename** is `schema_marketplace_messaging_idempotent.sql` — the `_idempotent` suffix because the original wasn't safely re-runnable and Cory hit an error mid-run that required a redo. The idempotent version is now the canonical file. If you ship more SQL for these tables, follow the same `drop policy if exists` pattern.
- **Marketplace photo upload route already moderates images.** Don't add moderation a second time. If you're touching `/api/upload-marketplace-photo`, the gate is already in there; mirror the existing pattern.
- **Orphan-claim defense is in place.** `/api/gigs/[id]/delete` cascades through FK to remove claims, but `app/my-gigs/page.tsx` ALSO filters out any claim whose `gigs` join comes back null — belt-and-suspenders against a stale claim row showing as a ghost count. If you build a new view of claims (e.g. flipper-side history pages, an admin claims list), apply the same filter. The matching SQL safety net is `supabase/schema_cleanup_orphan_claims.sql` which both deletes any existing orphans AND re-asserts the `on delete cascade` FK. Safe to re-run.
- **DO NOT BREAK: Supabase Site URL must be `https://myflipwork.com`** (NOT the vercel.app URL). It's set in Supabase Authentication → URL Configuration. If anyone ever resets it to the vercel.app domain, OAuth on iPhone breaks silently — Google redirects to vercel.app, the existing `*.vercel.app → myflipwork.com` 308 redirect strips the URL fragment, and the auth token vanishes. Users land on `/marketplace` signed out, no error.
- **DO NOT BREAK: OAuth must NEVER route through the `*.vercel.app → myflipwork.com` 308 redirect** for the same reason as above (308s strip fragments). The Vercel 308 is still in place for catching stale bookmarks, which is fine. Just don't make Supabase emit OAuth redirects through it.
- **Testing OAuth changes:** always test in a fresh incognito window on the actual `myflipwork.com` domain. Starting on a vercel.app URL produces the bad version of the flow.
- **Vercel has a hard 4.5MB body limit** on serverless functions — bigger requests get a `413 FUNCTION_PAYLOAD_TOO_LARGE` at the gateway, which returns HTML (not JSON). Every client form should compress images >1MB via `lib/imageCompression.ts` before upload AND wrap `res.json()` in try/catch. There are 6 live upload paths all using this pattern — if you add a 7th, mirror it. The cedar-bed JPEG (4.6MB iPhone original) is a good reproducer.

---

## What's next (next session)

**This session: small focused UX polish around gig previews — no new systems, no schema changes, no SQL.** Four commits, all in `/gigs` and `/flipper/dashboard` territory:

1. **Reference images now visible on the flipper side too.** The flipper dashboard list shows a 64px thumbnail per gig (first image by `sort_order`, placeholder icon if none). The flipper gig detail page renders the full reference-image grid using the existing `GigReferenceImages` component. Image URLs are built on the server in one batched query.
2. **Own posted gigs now appear in the worker browse feed**, mixed in by date with everyone else's, marked with a small "Your post" badge under the status pill. Footer link reads "View as worker" on own posts. The existing `isOwnPostedGig` branch on `/gigs/[slug]` already prevents claiming and shows a "You posted this gig" panel, so no extra detail-page work was needed. Cory wanted this so he can see his gig the way workers see it without using a second account.
3. **Checklist preview attempt** — added a full task-list preview to each browse card, Cory looked at it and asked to back it out (he wanted the checklist visible only on the detail page next to the description, not duplicated on every card). The detail page already shows the checklist. Net: card stayed compact, change was a no-op for users.

**Pattern carry-over for next session:** batch-fetching related rows (images, checklist items, etc.) for a list of gigs in a single query and grouping by `gig_id` is a much better pattern than the client-side N+1 fetch `GigListingCard` does for thumbnails on the worker browse cards. That worker-side N+1 is still there (each card runs its own thumbnail query in a `useEffect`). Not urgent — perf has been fine — but if `/gigs` ever gets slow, that's where to start.

---

**Previous session: killed two major iPhone bugs** — the photo upload hang and the OAuth hang. See "Previous session's commits" and the bugfix notes below for details. Tl;dr: Vercel 4.5MB body limit triggered 413s that returned non-JSON HTML, crashing every `res.json()` call silently. Fix was client-side image compression + try/catch around every res.json(). And Supabase Site URL was set to the vercel.app domain, which made OAuth redirect through the `*.vercel.app → myflipwork.com` 308 — and 308s strip URL fragments, so the auth token vanished. Fix was setting Supabase Site URL to `https://myflipwork.com` directly.

---

**Marketplace is the front door** and **marketplace messaging is live end-to-end**. The dashboard at `/home` still exists but is no longer the post-auth landing.

**Payments system has its safety net** (Phase 7 webhooks). Phases 5, 6, 8, 9 still needed before going live with real money.

**Streak counter** was pitched but deferred again — would require a new `user_activity_log` table with triggers backfilling events from claims/payouts/messages/gigs, plus a streak counter and richer activity feed on `/home`. Still the obvious "addicting to check" next move for the dashboard if Cory ever wants it.

Cory's most likely next moves, in rough order:

1. **Back button on Step 2 of Post a Gig flow.** Cory asked for this two sessions ago, asked the clarifying "what should back do" question (option A = back to Step 1 same flow, option B = route to Edit Gig page), then deferred — "skip this for now, focus on the photo delete bug first." Never got back to it. Same pattern as the List an Item back button shipped two sessions ago (`1b9a0c0`) — Step 1 already creates the gig, so coming back needs to switch save from create → update. Reference that commit for the pattern. Cory's preference was unstated; ask before building.

2. **Mutual cancel for gigs + tighten hard delete.** Known safety hole shipped a previous session: a claimed gig can be hard-deleted even when a worker is mid-claim (as long as no Stripe money has moved). Plan is to build an Upwork/TaskRabbit-style mutual cancel (either side requests, the other accepts/declines via system message in chat, claim → `cancelled_by_mutual_agreement`, Stripe auth released), and at the same time block hard delete when any claim is in `pending`/`active`/`submitted_for_review`. Full plan + file touches are in TODO #11.

3. **Terms of Service, Privacy Policy, Worker Agreement, Flipper Agreement.** Worker agreement is currently a placeholder (`legal_agreements` table). Flipper agreement doesn't exist yet — the current schema only gates workers. Cory wanted to draft all four a previous session but we paused at the intake questions and didn't draft anything yet. **Before drafting, the next session needs Cory to answer:**
   - Legal entity behind FlipWork (sole prop vs. LLC). If LLC, the docs name "FlipWork LLC" so they don't have to be rewritten after formation.
   - State of operation (California is meaningfully harder due to AB5 gig-worker classification rules — worker agreement has to be much more careful about not implying employment).
   - Local-only vs. nationwide (affects how much state-specific hedging the docs need).
   - Whether forming an LLC before Stripe Phase 9 go-live is on the table — recommend yes for liability protection given real money flow.

   Plan once those are answered: draft all four documents, get them into the `legal_agreements` table (or wherever the Flipper one will live), then strongly recommend Cory pay an attorney for a 30-minute review of the gig agreement specifically before Phase 9 — California labor law has real teeth here.

4. **Marketplace location filter v2: zip-based + 100-mile radius.** A previous session shipped exact-city-match only. The full plan is zip-based: add `zip` to `worker_profiles`, `flipper_profiles`, and `marketplace_listings`; build a zip → lat/long lookup; show "within 100 mi of {zip}" with toggle. For logged-out users, prompt for zip and store in localStorage. Will naturally cover the logged-out marketplace location case too (currently they see all 60 most recent listings nationwide).

5. **Show available gigs in the marketplace feed.** Cory wants a toggle (like the Free only pill) to mix gigs into the marketplace view. Deferred a previous session because there's no real data yet to design against. Decisions still open: how the toggle works (items/gigs/both vs. either/or), whether to show gigs to logged-out users (they can't apply without Stripe Connect — discovery vs. bounce tradeoff), and how to make gig cards visually distinct from listing cards.

6. **Listing reports — Report button + admin queue.** Table exists, button + admin UI don't. Mirrors the existing `image_reports` flow.

7. **Stripe Connect Phase 5: Worker payout UI polish.** Show Stripe Express dashboard login link on `/my-gigs/payouts`, show expected payout arrival window, surface Stripe-side status (Pending / In transit / Paid) instead of legacy "unpaid/pending/paid."

8. **Stripe Connect Phase 6: Admin payout UI upgrade.** Show stripe_payment_intent_id, payment_status, capture/refund buttons on the admin payouts page. With webhooks in place (Phase 7 done), this is much more useful.

9. **Email notifications** (Bucket 1 #1 — MARKETPLACE_ROADMAP.md). Needs an email provider (Resend / Postmark / SES). High-impact for retention.

10. **Stripe Connect Phase 8: Edge cases.** Flipper's card declines at capture time, worker's Connect account gets restricted after approval, auth expires before work is done, flipper requests refund after capture, gig is canceled after authorization. Webhooks now detect most of these; the work here is the UI/notification side.

11. **Stripe Connect Phase 9: Go-live.** Swap test keys → live keys, redo the webhook destination in LIVE mode in Stripe (test-mode destinations don't carry over — Cory needs to make a second one and put the live `whsec_...` in Vercel), one real $1 transaction to verify, monitor.

12. **Streak counter + activity log for `/home`** — deferred again, still the next obvious dashboard enhancement.

13. **Address/pickup details on gigs** (Bucket 1 #3) — paired with messaging; reveal-after-pick.

14. **Ratings/reviews** (Bucket 1 #4).

15. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.

16. **Rotate `SIGHTENGINE_API_SECRET`** — overdue across multiple sessions. Two-minute task.

17. **Place `ReportImageButton`** on photo views (gig and marketplace).

18. **Dashboard discoverability micro-fix on `/flipper/dashboard`.** The current flipper-specific dashboard has no signal for "work submitted, awaiting your review." The "Pending applicants" tile only counts pending claims. Lower priority since `/home` surfaces this via the "needs review" action card.

19. **"Payouts" nav link is worker-centric.** Currently shown to everyone; flippers hitting it see "$0 earnings" empty state. Either rename it, hide it for users with no payout history, or build a paired flipper-side "Payments you've made" view. Low priority — Cory was aware and laughed it off, but worth fixing eventually.

Cory will pick. Open by confirming what you're about to build in 2-3 lines, then build.

---

## This session's commits (most recent first)

- `87f7a70` Remove checklist preview from browse-gigs card: backed out the checklist preview added two commits earlier. Cory wanted the checklist visible only on the gig detail page next to the description, not duplicated on every browse card. Cleanly removed the prop, the batch query in `app/gigs/page.tsx`, and the unused `ListChecks` / `Check` imports. Cards are back to compact mode.
- `99e6b6f` Show full checklist preview on each browse-gigs card: batch-fetched all checklist items for visible gigs in one query, grouped by `gig_id`, passed through `GigFilterContent` → `GigListingCard`. Card renders the full task list in a small muted box with task count header and required (*) markers. Shipped, then reverted by `87f7a70` after Cory saw it.
- `96e36bf` Show user's own posted gigs in browse, marked with 'Your post' badge: removed the `.or()` filter from `app/gigs/page.tsx` that hid own gigs. `GigListingCard` got an `isOwnPost` prop and shows a small "Your post" badge under the status pill when set. Footer link reads "View as worker" on own posts. The existing `isOwnPostedGig` branch on the gig detail page already prevents claiming and shows a "You posted this gig" panel with a button back to the flipper dashboard, so no extra work needed there.
- `f4a7513` Show gig reference images in flipper dashboard list + flipper gig detail: `/flipper/dashboard` now shows a 64px square thumbnail per gig (first uploaded reference image by `sort_order`, or a placeholder `ImageIcon` if none). One batched query fetches all images for visible gigs, then we pick the lowest sort_order per gig and build public URLs once on the server. `/flipper/gigs/[id]` now renders the existing `GigReferenceImages` component below the gig header card — same UI workers see.

## Previous session's commits

- `a44d10f` Remove finishing-page debug box + bump cookie wait to 500ms for iOS Safari: cleaned up the temporary debug panel from `/auth/finishing` now that the iPhone OAuth bug is diagnosed and fixed. Also bumped the cookie-commit wait from 150ms → 500ms as cheap insurance for iOS Safari being slow to persist large chunked Supabase auth cookies.
- `5b6a07a` DEBUG: on-screen log on /auth/finishing for mobile OAuth diagnosis: temporarily added an on-screen debug panel below the spinner to diagnose why iPhone OAuth hung on "Almost done…". Showed the entire flow completed successfully — root cause turned out to be domain mismatch (OAuth started on the Vercel preview URL, not the custom domain). This commit was reverted by `a44d10f`.
- `7256073` Wire image compression into remaining 4 upload paths: applied `compressImageForUpload` + 413-safe JSON guard to `app/profile/page.tsx` (avatar), `app/my-gigs/[claimId]/PhotoSection.tsx` (gig proof photos), `components/admin/GigImageUploader.tsx` (gig reference images), `components/ui/PhotoUploadForm.tsx` (worker/flipper gallery). Two dead-code paths `/profile/worker` and `/profile/flipper` deliberately left alone per HANDOFF rule.
- `35f2b65` Compress images on EditListing too + handle Vercel 413 cleanly: previous commit only fixed `NewListingForm`; the 4.6MB iPhone JPEG was actually being uploaded from `EditListingForm` which was still sending raw. Also: every `res.json()` call now wrapped in its own try/catch so Vercel's 413 (which returns HTML, not JSON) shows a clean "too large" message instead of crashing with a SyntaxError and hanging the spinner. This is the commit that finally fixed the original cedar-bed photo reproducer.
- `5d9d085` Add browser-side image compression for marketplace photo upload: new `lib/imageCompression.ts` helper using `browser-image-compression@^2.0.2`. Shrinks any image >1 MB down to ~1 MB / 1920px on the longest side. Wired into `NewListingForm` first; other paths followed in `7256073`.
- `fdc4a8d` Fix marketplace photo upload hang: add maxDuration=60 + step logging: initial wrong-theory attempt at the upload hang. Set Vercel `maxDuration = 60` on the marketplace upload route (still useful for the legit case of a slow upload), added timestamped `console.log` at every step. Logs later revealed zero entries existed — the request never reached the function. Real cause was the 4.5MB Vercel body limit (fixed in subsequent commits).

**Configuration changes (no code) from the previous session:**
- Vercel Project → Settings → Domains: added `furniture-gig-corylts-projects.vercel.app` as a domain and configured BOTH `*.vercel.app` URLs (the team alias and the short alias `furniture-gig.vercel.app`) to issue a 308 Permanent Redirect to `myflipwork.com`. Originally framed as the OAuth bug fix; ended up causing a regression because 308s strip URL fragments — see "DO NOT BREAK" notes in "Watch out for." The real OAuth fix was changing the Supabase Site URL.

## Older commits

- `5186236` Add visible delete + arrow-button reorder for listing photos: new API route `POST /api/marketplace/[id]/reorder-photos` (owner/admin only, defensively verifies every photo belongs to the listing), photo grid in both `NewListingForm.tsx` and `EditListingForm.tsx` got always-visible delete button + cover badge + up/down arrow buttons + disabled state at ends. Reorder uses optimistic UI with rollback. Removed misleading "Drag-to-reorder coming soon" copy.
- `9796c9f` Fix indefinite hang on listing photo upload: added 30s AbortController timeout to the Sightengine fetch in `lib/moderation.ts` (returns existing `service_error` result on abort), added 60s AbortController timeout to the client fetch in `NewListingForm.tsx`, added per-photo try/catch so one bad photo doesn't lock the whole loop. (Didn't actually fix the hang — see this session's commits for the real fix.)
- `1b9a0c0` Add 'Back to details' button on List an Item photos step: button at top of Step 2 calls `setStep('details')`, save handler in Step 1 now branches: if `savedListingId` exists, calls `/api/marketplace/[id]/update` instead of `/api/marketplace/create` to avoid duplicate listings. Step 1 button label dynamically shows "Save changes" when returning vs. "Continue to photos" on first pass.
- `84fb9c7` Fix 401 on photo gallery delete by using shared server client: `/api/delete-gallery-photo` was hand-rolling its own Supabase client with the newer `getAll/setAll + await cookies()` style, mismatching the rest of the codebase that uses `lib/supabase/server.ts`'s `get/set/remove + sync cookies()` style. `auth.getUser()` always returned 401. Switched to the shared `createClient()`.
- `761b067` Add checklist editor to gig create/edit forms: new reusable `components/shared/ChecklistEditor.tsx` (title/description/required toggle/up-down ordering/remove + 6 quick-add suggestions), wired into `PostGigForm.tsx` between Short Summary and Full Description, wired into `EditGigForm.tsx` with delete-all + reinsert sync strategy on save. New SQL migration `supabase/schema_checklist_flipper_rls.sql` adds a policy letting gig posters manage checklist items on their own gigs (previously only admins could). Cory ran the SQL in prod.
- `4f98ee9` Add 'Chest of Drawers' and 'Nightstand' to furniture type dropdown: updated `FURNITURE_TYPES` array in both `PostGigForm.tsx` and `EditGigForm.tsx` to keep them in sync.
- `c1f0f4d` Hide archived gigs by default; add 'Show archived' toggle on flipper dashboard: `FlipperGigList.tsx` got a `showArchived` state, archived gigs filter out by default, a `Show archived (N)` checkbox renders only when archived gigs exist. Also fixed the `Total Gigs` stat tile to exclude archived. Public marketplace was already filtered to `status='open'` so no change needed there.
- `c90f9f0` Swap city/state order: State on left, City on right: one fix to the shared `components/ui/location-select.tsx` covers 9 pages (worker/flipper onboarding, profile editors, post-gig, edit-gig, new listing, edit listing, etc.) plus the marketplace filter `components/worker/GigFilterContent.tsx` which had its own copy. Reasoning: city dropdown was disabled until state was picked, so left→right tab/click flow was awkward.

## Even older commits

- `df33049` Fix ghost count on /my-gigs from orphan claims: app-side filter skips claims whose `gigs` join is null (orphan from before cascade was reliable), plus a one-time SQL cleanup file `schema_cleanup_orphan_claims.sql` that deletes any existing orphans AND re-asserts the `on delete cascade` FK so new ones can't appear after a gig delete. SQL was run on prod.
- `8448e85` Fix stale count on /my-gigs after a gig is deleted: added `export const dynamic = 'force-dynamic'` + `export const revalidate = 0` to `app/my-gigs/page.tsx`. Tab badges were caching and showing pre-delete counts.
- `4887c65` HANDOFF: log delete/archive work + mutual-cancel TODO
- `be99d6c` Add gig delete + fix mobile archive (modal-based confirms): new POST /api/gigs/[id]/delete with Stripe-money guard, new SQL RLS DELETE policy for gig posters, new ConfirmActionModal replacing window.confirm() (was failing on mobile), Delete button on edit page + three-dot menu on flipper dashboard rows.

- `275196b` Marketplace as front door: logo → /marketplace, post-auth lands on /marketplace, preserve ?next= through signup/login/Google
- `01804bb` Marketplace messaging: Nav unread badge counts listing messages too
- `245427e` Marketplace messaging: inbox shows both gig and listing conversations
- `977de9c` Marketplace messaging: chat page & ChatClient handle both gig and listing conversations
- `ee7dccf` Marketplace messaging: wire Message Seller button on listing detail
- `e8069db` Marketplace messaging: POST /api/listing-messages/start (find-or-create conversation)
- `90b8014` SQL: idempotent version of marketplace messaging schema (safe to re-run)

## Stripe Connect early commits

- `b6d74c8` Stripe Connect Phase 4: RLS fix + silent-failure guards
- `85e0ec4` Stripe Connect Phase 4: flipper-side review page (not admin)
- `922d3f1` Stripe Connect Phase 4: capture on approval
- `b96b05a` Stripe Connect Phase 3: RLS fix - flippers can INSERT/UPDATE their own payout_records
- `e39d4b0` Stripe Connect Phase 3: wire ApplicantActions to /api/stripe/pick-worker + 3DS handling
- `12b9ad6` Stripe Connect Phase 3: pick-worker API route (authorize on pick)
- `b61a85c` Stripe Connect Phase 3: authorizePickPayment helper
- `fd9c564` Stripe Connect Phase 3: SQL for flipper RLS + flipper_user_id index
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
