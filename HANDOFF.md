# FlipWork — Handoff

> Compressed May 28, 2026. Full history lives in `git log`; this doc keeps only
> what's true *now* plus the gotchas that save the next session real time.

> **Most recent first:** read `HANDOFF_2026-06-22.md` — a long session covering the
> orange→green theme, animated hero, the past-sale backfill (now with photo + quantity),
> Books money buckets / "Move money" transfers / Tax-year screen, the bucket-activity
> search + thumbnails + inline delete, edit-entry improvements (piece cost, photo,
> return-to-origin), the `/install` PWA guide, AI-support escalation emails, and — the
> headline — **monetization**: a freemium Pro ($9/mo) tier with Stripe billing wired up
> (checkout/portal/webhook), feature-gating (no piece cap), and admin auto-comp. It lists
> the SQL still to run and the **Stripe finish/blocker** (the "billing not set up" =
> `STRIPE_PRICE_ID_PRO` env var) — start there. Then `HANDOFF_2026-06-17d.md` — the
> "make the piece the hub" plan: the **Books ledger is now the one source of truth
> for every cost AND every worker payment** (a piece is a tag, a worker is a tag),
> the **worker/gig side is shelved** (operator-only — Post a Job + My Jobs hidden),
> worker pay + 1099 tracking now run off **logged labor tagged to a crew member**,
> and a worker's paid numbers match across My Crew, their page, and Payment Records.
> It also lists the SQL Cory still needs to run + the deploy checklist. Then
> `HANDOFF_2026-06-17c.md` (the game layer `/play` + share-link + the direction this
> session built), `HANDOFF_2026-06-17b.md` (Books migration + photos) and
> `HANDOFF_2026-06-17.md` (merge background). The June 3 QuickBooks notes below are
> older/shelved.

---

## Latest session — June 3, 2026 (QuickBooks integration · SANDBOX, not yet live)

Built a full QuickBooks Online bookkeeping pipeline. **It all works against a
practice (sandbox) company — it is NOT yet pointed at real books.** Going live is
the next session's job (checklist below). All shipped to `main`; SQL + env below.

**OAuth connect.** `app/api/quickbooks/connect|callback|disconnect/route.ts` +
`lib/quickbooks.ts` (authorize URL, code/token exchange, refresh-token revoke,
`qbBasicAuth`, `qbConfig`, `qbIsConfigured`). Connection saved in
`quickbooks_connections` (one row/user: realm_id, access/refresh tokens, expiries,
environment). Settings page `app/flipper/quickbooks/page.tsx` (Connect / Disconnect /
status) + `TestConnectionButton.tsx` (reads CompanyInfo to prove the link).

**API layer** `lib/quickbooks-api.ts`: `getFreshConnection(userId)` reads the row
(admin client) and refreshes the access token if within 5 min of expiry, saving the
new pair; `qboFetch(conn, path, init)` makes authenticated calls (base URL sandbox vs
production by `environment`).

**Receipts** (`/flipper/receipts`, `ReceiptScanner.tsx`). Snap →
`app/api/receipts/scan/route.ts` (Anthropic Haiku 4.5 vision via `lib/anthropic.ts`
`SUPPORT_MODEL`; returns vendor/date/total/**items[]**). The user splits the receipt
into lines, tags each line to a **piece** or leaves it **General**, picks a category.
Save → `app/api/receipts/save/route.ts`: creates **ONE** QBO Purchase with a line per
receipt line (each line's account from the category map), attaches the photo **once**,
and for piece-tagged lines ALSO writes a `piece_expenses` row + a `quickbooks_synced`
marker so the piece sync won't repost it.

**Cost mapping** `CostMapping.tsx` + `app/api/quickbooks/settings/route.ts` →
`quickbooks_settings` (paid_from_account_id, `category_map` jsonb {flipwork category →
QBO account}, income_account_id, deposit_to_account_id). `app/api/quickbooks/accounts/
route.ts` returns paidFrom / categories(expense) / income(Revenue) / bank lists.

**Per-piece sync** `app/api/quickbooks/sync-piece/route.ts` (POST {pieceId}). Sends
acquisition_cost (as `purchase`) + each piece_expense as QBO **Purchases**, and a sold
piece's sale_price as a QBO **Deposit** (DepositLineDetail.AccountRef = income account,
DepositToAccountRef = bank). Idempotent via `quickbooks_synced` (unique
owner+source_type+source_id; source_type ∈ piece_acquisition | piece_expense |
piece_sale). Button "Send to QuickBooks" in `PipelineBoard.tsx` PieceCard, shown only
when `qbReady` (connected + mapping set), threaded from the pipeline page. Also: clickable
pipeline cards + clickable HUD stat breakdowns + an off-platform "Mark complete" button +
a `purchase` expense category were added earlier this session.

**SQL run (Supabase):** `schema_quickbooks_connections_20260603.sql`,
`schema_quickbooks_settings_20260603.sql`, `schema_quickbooks_settings_income_20260603.sql`,
`schema_quickbooks_synced_20260603.sql`, `schema_piece_expenses_add_purchase_category_20260603.sql`.

**Env vars (Vercel, Production):** `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`
(currently **development/sandbox** keys), `QUICKBOOKS_REDIRECT_URI` =
`https://myflipwork.com/api/quickbooks/callback`, `QUICKBOOKS_ENVIRONMENT` = `sandbox`.
Also added **`NEXT_PUBLIC_SITE_URL` = `https://myflipwork.com`** (fixed the OAuth redirect
landing on the *.vercel.app deploy domain).

**Intuit setup:** app "FlipWork" at developer.intuit.com; redirect URI registered on the
**Development** side. Had to **create a sandbox company** manually (developer portal →
Sandbox companies → Create, QBO Plus / US) — connect failed "no sandbox companies found"
until then.

**GO-LIVE checklist (next session — point at REAL books):**
1. developer.intuit.com → complete the **Production app assessment** (App details +
   Compliance) → get production keys.
2. Vercel → swap CLIENT_ID/SECRET to the **production** values; set
   `QUICKBOOKS_ENVIRONMENT=production`; redeploy.
3. Reconnect at `/flipper/quickbooks` (now picks the real company); redo the cost mapping
   against real accounts.
4. **Sanity-check the mapping with Cory's accountant before relying on it** (books accuracy).

**Gotchas that cost real time:**
- `components/ui/button.tsx` Button always renders a hidden loading slot, so
  `<Button asChild>` hands Radix Slot two children → `React.Children.only` throws → page
  crash. Don't use Button asChild; style a `<Link>` with `buttonVariants(...)`.
- `getSiteUrl()` falls back to `VERCEL_URL` (per-deploy *.vercel.app host) when
  `NEXT_PUBLIC_SITE_URL` is unset → OAuth callback redirected to the wrong domain and
  bounced to login. Fixed by setting `NEXT_PUBLIC_SITE_URL`.
- Sales use a QBO **Deposit**, NOT SalesReceipt, to avoid needing Item/Customer records.
- Attachment upload = multipart parts `file_metadata_01` + `file_content_01`; best-effort
  (expense still saved if the photo attach fails).

**Double-count cautions (by design — tell Cory):**
- Both doors into QBO share `quickbooks_synced` ONLY for piece-tagged items. A receipt line
  tagged to a piece → piece_expense + synced marker → piece sync skips it. General receipt
  lines are standalone QBO expenses.
- The piece "Paid" box (acquisition_cost) is already sent as a `purchase` expense by the
  piece sync — do NOT also log the buy price as a separate purchase line, or it doubles.

**Open follow-ups:** editing/deleting a FlipWork cost after sync does NOT update/remove the
QBO entry (no back-sync); income mapping must be set for sales to sync; pre-existing Stripe
dead-code cleanup still pending (live landmine: admin `ReviewActions.tsx` capture call).

---

## Previous session — June 3, 2026 (App polish · pay→pipeline · off-platform crew)

A later June-3 session. All shipped to `main`; SQL to run is listed below. Cory
deploys via local `git pull` / `git push` (~45-60s for Vercel).

**Installable app (PWA).** FlipWork installs to the phone home screen.
`app/manifest.ts`, `public/icon-192.png` + `icon-512.png`, and manifest/appleWebApp/
themeColor metadata in `app/layout.tsx`. `components/notifications/AddToHomeScreenPrompt.tsx`
shows an install guide (hides once installed or dismissed — localStorage `fw_a2hs_dismissed`).

**Web Push notifications (working).** Fires on a new message from
`app/api/messages/notify/route.ts`. Pieces: `lib/push.ts` (`sendPushToUser`,
`web-push@3.6.7`, service-role client), `public/sw.js` (**notifications-only** service
worker — NO offline caching, deliberate), `app/api/push/subscribe|unsubscribe|test/route.ts`,
`components/notifications/EnableNotificationsButton.tsx` (auto re-subscribes on open when
permission is granted; "Send a test buzz" diagnostic). **Controls live in Account
Settings** (`/profile` → Notifications), not the dashboard. SQL run:
`supabase/push_subscriptions_20260602.sql`. VAPID: public key is hardcoded as a fallback
(also env-overridable); **private key is in Vercel as `VAPID_PRIVATE_KEY`**. iOS requires
home-screen install + one "Allow" tap. **Gotcha that ate time:** the private key was
pasted into Vercel's *Note* field instead of *Value* → push silently dead until fixed.

**Stay logged in.** `app/api/auth/set-session/route.ts` cookie now lasts 1 year (was
~1 hour, tied to the access-token expiry). NOTE: each user must sign in once after this
deploy to pick up the long cookie.

**Dashboard cleanup.** `app/home/page.tsx`: install prompt + notifications button +
Business Setup card up top; the empty "needs attention" grid only renders when it has
content; `components/home/UnreadMessagesCard.tsx` is a standalone live (realtime) unread
count that matches the bell. `BusinessSetupCard` gained a `mode` prop — `dashboard`
(hides when complete) vs `settings` (always shows; self-loads); it's also rendered on
`/profile` with `mode="settings"`. Dashboard breadcrumb removed. Hamburger menu now
scrolls so Logout is always reachable; removed a duplicate unread badge from it.

**Jobs / Gigs wording split (visible copy only).** Operator/flipper screens say
**"Jobs"** and **"crew"**; worker screens stay **"Gigs."** URLs (`/gigs`,
`/flipper/post-gig`) and DB names were NOT touched. Mental model: hiring = Job, picking
up work = Gig.

**Job → Pipeline link.**
- Posting a job can **auto-create** an `inventory_pieces` row (stage `sourced`).
  `PostGigForm.tsx`: opt-out checkbox "Add this to my Pipeline" (default on, remembered
  via localStorage `fw_add_to_pipeline`); optional "What you paid for the piece" →
  piece `acquisition_cost` (NEVER stored on the gig — can't leak to workers). The piece
  is stamped with **`source_gig_id`**.
- SQL: `supabase/schema_inventory_pieces_source_gig_20260603.sql` (adds `source_gig_id`).
- `components/shared/PayWorkerCard.tsx` now has an editable **"Amount paid"** field
  (defaults to posted pay; "Cash (in person)" was already an option). On "Mark as paid"
  it records the pay as a **`piece_expenses` row, `category='labor'`** on the linked
  piece — so it lands in the profit HUD. Confirmation messages show the real amount paid.

**Off-platform crew.** For people with no account (e.g. a friend with a busted phone).
- SQL: `supabase/schema_crew_offplatform_20260603.sql` — makes `crew_members.worker_user_id`
  nullable and adds `worker_name`, `jobs_count`, `paid_total`, + an identity CHECK
  (a row must have a user_id OR a name).
- On an **Open** job, the "⋮" menu has **"Mark done (off-platform)"** → modal asks
  worker name + cash → marks the job `completed`, logs the cash as a `piece_expenses`
  labor row on the linked piece, and saves the person to Crew **by name**
  (find-or-create; case-insensitive but otherwise exact; bumps jobs/cash tally).
  `app/flipper/dashboard/FlipperGigList.tsx` (`handleOffPlatform` + custom modal).
- `app/flipper/crew/page.tsx` fetches off-platform members into an **"Off-platform
  crew"** section rendered by `app/flipper/crew/OffPlatformCrewList.tsx` (editable cards:
  name, rating, rehire, private notes — saved by `crew_members.id`, NOT `worker_user_id`,
  because the existing `CrewList`/`CrewCard` upserts on `worker_user_id` and can't hold a
  name-only person).

**SQL to run (this session) — Cory runs in Supabase, raw URL → SQL Editor → Run:**
- `supabase/push_subscriptions_20260602.sql`
- `supabase/schema_inventory_pieces_source_gig_20260603.sql`
- `supabase/schema_crew_offplatform_20260603.sql`

**New gotchas:**
- **Profit math reads `piece_expenses`, NOT `inventory_pieces.labor_cost`.** The Pipeline
  HUD is `acquisition_cost + sum(piece_expenses)` (`costsOf` in `PipelineBoard.tsx`).
  Worker pay is recorded as a `category='labor'` expense — this was FIXED this session
  (it previously wrote the ignored `labor_cost` column and never showed in profit). If
  you ever record a piece cost, write a `piece_expenses` row.
- `public/sw.js` is **notifications-only** (no caching) on purpose — don't add caching
  casually (stale-asset risk in a PWA).
- VAPID private key goes in Vercel's **Value** field, never the Note field.
- Off-platform crew has **no "remove" yet** (no hide/restore for name-only members) —
  only rating/notes/rehire/name editing. Possible follow-up.
- Off-platform name match is case-insensitive but otherwise exact ("Marcus" ≠ "Marc");
  rename a card to merge two records.

---

## Previous session — June 3, 2026 (Operator-Hub buildout)

**Strategic shift (drives everything below).** Stopped treating FlipWork as a
two-sided "everything-flippable" marketplace and refocused on ONE customer: the
**flipping *operator*** — someone running a flipping business who wants to hire and
manage contract help without Craigslist sketchiness or W-2 overhead. The product
is becoming an **operator hub / light resource-management ("tycoon") tool**. The
worker/marketplace side still exists but is de-emphasized. Monetization thesis
unchanged: pro/business subscription, never a cut of payments; validate before charging.

**Go-to-market (agreed, not built):** dogfood it (Cory runs real jobs/flips through
it) → micro-influencer outreach to flipping creators (e.g. Transcend Furniture
Gallery on YouTube). The one build that serves the test is an operator-facing
front door/landing. Public cross-operator reputation is deferred (scale problem;
private My Crew ratings cover solo vetting for now).

**Shipped this session (live on main; operator screens reframed "gigs"→"Jobs", people→"crew"):**
- **My Crew** (`/flipper/crew`) — roster of everyone you've picked, with track record
  + your private rating / notes / would-rehire. "Remove" = hide (restorable), not delete.
- **Payment Records** (`/flipper/records`) — per-worker per-year payouts from
  `gig_payments`, with a **year-correct 1099 flag** and one-tap **CSV export**.
- **Business Setup card** on `/home` — interactive guided check-offs that capture real
  details (name, structure, EIN, bank, bookkeeping, contractor paperwork) into a
  business profile, with progress bar. Contractor item links to the printable **W-9** PDF.
- **Pipeline board** (`/flipper/pipeline`) — the resource-game core. Pieces move
  Sourced→In Progress→Listed→Sold; per-piece **photos** (moderated upload), an
  **itemized expense ledger**, and a **profit / cash-tied-up / profit-this-month HUD**.
- **Nav reordered** operator-first: My Profile, Messages, Dashboard, then Flipper,
  Worker, Marketplace groups. Dashboard "Go to" is flipper-first too.

**New tables (all run in Supabase):** `crew_members` (+`hidden`), `business_profiles`,
`inventory_pieces`, `piece_expenses`. New route `/api/upload-piece-image` (mirrors
upload-service-image; bucket `marketplace-photos`).

**Cleanup TODO:** `operator_business` table + `supabase/schema_operator_business_20260601.sql`
are an **orphan** from a duplicate attempt during a connection drop — the live Business
Setup card uses `business_profiles`. Drop the dead table and delete the SQL file when convenient.

**Decisions worth remembering:**
- 1099-NEC threshold is **year-dependent**: $600 through 2025, **$2,000 for 2026+** (OBBBA).
  The Records 1099 flag uses the selected year's threshold.
- Use **W-9** (contractor TIN), not I-9 (employee) — matches the contractor model.
- Pieces use the **itemized `piece_expenses` ledger**; old lump materials_cost/labor_cost
  columns on `inventory_pieces` are retired/ignored in the UI.

**Standing risk to keep flagging (not legal advice):** the "call everyone a contractor /
avoid the govt" model is legally fragile (worker misclassification; the platform's
checklists add "control" signals). Point Cory to a NC employment/tax attorney; don't help
defeat the rules.

---

## Project basics

- **App:** FlipWork — a two-sided platform for the flipping economy. People post gigs, claim gigs, sell items on a marketplace, and (new) advertise services they offer. Furniture was the origin; it's now "anything that can legally be flipped."
- **Repo:** `github.com/CoryLT/furniture-gig` (code name stayed `furniture-gig`; brand is FlipWork).
- **Stack:** Next.js 14.1 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind 3.3 · Resend (email) · Sightengine (image moderation) · Anthropic (AI support + receipt reading) · QuickBooks Online API (bookkeeping sync — sandbox for now). Deployed on Vercel.
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
