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
- **AI support chat at `/support`** — Haiku 4.5 agent for logged-in users. Answers FAQs, looks up the user's own gigs/payouts/Stripe status, escalates serious issues. Admin queue at `/admin/support`. See "AI support chat" section below.
- **Terms of Service + Privacy Policy v1.0 LIVE** — full ~10k-word documents seeded into `legal_agreements` table. Public read at `/legal/terms` and `/legal/privacy` (no login required, search-engine friendly). Logged-in users hitting `/marketplace` get force-redirected to `/auth/agreements` if anything required is unaccepted. New signups already hit the agreements flow naturally. Operating entity = Groovy Greens, LLC (NC) d/b/a FlipWork. Governing law = NC. Mandatory binding arbitration + class action waiver. See "Legal docs (TOS + Privacy)" section below.

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

## AI support chat (DONE — shipped this session)

Haiku 4.5 agent at `/support` for logged-in users. Answers FAQs, looks up the user's own gigs/payouts/Stripe status via tools, escalates serious issues to admin.

### Tech basics
- **Model:** `claude-haiku-4-5-20251001` (~1-2¢ per chat)
- **SDK:** `@anthropic-ai/sdk` ^0.98.0
- **Env var:** `ANTHROPIC_API_KEY` on Vercel (set this session)
- **Cost protection:** 5 chats/day/user, 50 messages/chat hard caps in code
- **Page:** `/support` (was a 404 before — now a real chat page)
- **Admin queue:** `/admin/support` with red badge on `/admin` dashboard when escalated count > 0

### Tools the agent has
1. `get_my_gigs_posted` — gigs user posted (as flipper)
2. `get_my_applications` — gigs user applied to (as worker)
3. `get_my_payouts` — payment records
4. `get_my_stripe_status` — Stripe Connect readiness
5. `escalate_to_admin` — flags conversation with `reason` + `summary`; flips status to `'escalated'`

All read-only DB lookups use service-role client BUT manually filter by `userId` from auth context — no cross-user data leakage.

### Escalation triggers (from system prompt)
- Legal threats / lawsuits
- Refund requests for already-captured money
- User-on-user fraud/abuse reports
- Confirmed bugs
- Account/data deletion requests
- Abusive user behavior
- AI tried 2+ times and can't answer
- User explicitly asks for a human

### DB tables (`supabase/schema_ai_support.sql` — already run)
- `support_conversations` — id, user_id, status (active/resolved/escalated), summary, escalation_reason, message_count, timestamps
- `support_messages` — id, conversation_id, role (user/assistant/system), content, created_at
- RLS: users see own, admins see all. Inserts done via service-role client from the API route.
- Trigger `bump_support_conversation_on_message` auto-updates `last_message_at` + increments `message_count` on every insert.

### Key code files
- `lib/anthropic.ts` — SDK client + constants (model name, rate limits)
- `lib/support-prompt.ts` — the system prompt (the AI's "personality and rulebook"). EDIT THIS to teach the agent new things or change tone. No code change needed — just edit the string.
- `lib/support-tools.ts` — tool schemas + handlers. Add new tools here.
- `app/api/support/chat/route.ts` — main endpoint. Tool-use loop with `MAX_TOOL_ROUNDS = 5`. Always returns 200 with `{ reply, status, conversationId }` unless auth/rate-limit fails. On Anthropic API errors, returns 502 with a friendly message.
- `app/api/support/conversations/route.ts` — list user's conversations
- `app/api/support/conversation/[id]/route.ts` — load one conversation + messages
- `app/api/support/resolve/route.ts` — user marks own chat resolved
- `app/api/admin/support/set-status/route.ts` — admin reopen/resolve
- `app/support/page.tsx` + `SupportClient.tsx` — the user-facing chat UI (sidebar list + chat panel, dark user bubbles, light AI bubbles, typing indicator, optimistic UI)
- `app/admin/support/page.tsx` — admin queue (tabs: escalated / resolved / all)
- `app/admin/support/[id]/page.tsx` + `AdminSupportActions.tsx` — admin views one conversation with full message history + reopen/resolve buttons
- `app/admin/page.tsx` — added Support tile with escalated count badge

### Quirks worth knowing
- The system prompt mentions specific routes (`/profile/payments`, `/post-gig`, etc). If you rename a route, also update the prompt or the AI will send users to a 404.
- Tool handlers cast Supabase queries with `as any` for the same TS-types-out-of-sync reasons as the Stripe code.
- The agent CAN'T see other users' data, only the caller's. If you add tools that touch other users (e.g., "look up the flipper I'm applying to"), be careful with scoping.
- `escalate_to_admin` is the only tool that WRITES to the DB. Everything else is read-only.
- No email notification to Cory when something escalates yet — he checks `/admin/support` manually. The badge on `/admin` is the visible signal. Email notifications are a future enhancement (would tie into the broader notifications TODO #8).
- The `users` table has a `role` column that's either `'admin'`, `'worker'`, or `'flipper'`. Admin checks use `where users.role = 'admin'`.

### Markdown rendering (DONE — shipped this session)

AI replies render through `react-markdown` + `remark-gfm` inside a `.chat-markdown` CSS class. Bold, lists, links (open in new tab), code, blockquotes all work. User messages stay plain text (no point parsing what they typed).

**Important**: the system prompt has a "Formatting" section that tells the AI to use backticks for URL paths (`` `/profile/payments` ``) instead of bold. This is because markdown can't parse `**` wrapping text starting with `/` — it renders as literal asterisks. If you find the AI emitting raw `**asterisks**` in production, check the prompt's Formatting section first.

### TODOs / future enhancements
- Email notification to admin on escalation (right now Cory checks `/admin/support` manually; the badge on `/admin` is the visible signal)
- Streaming responses for snappier UX (currently waits for full reply)
- Allow admin to reply IN the conversation as a human takeover (currently admin only views + resolves; user has no way to see admin replies)

---

## Legal docs (TOS + Privacy Policy) (DONE — shipped this session)

Full Terms of Service and Privacy Policy seeded as v1.0, public-facing pages live, agreements gate wired up for existing users. This closes Bucket 1 #5 in `MARKETPLACE_ROADMAP.md`. No real lawyer reviewed the docs yet — Cory plans to get a 1-hour small-business attorney review before going live with real money, but the docs are professional-grade and based on what real marketplace platforms use.

### Key decisions baked in
- **Operating entity:** Groovy Greens, LLC, a NC LLC originally formed for microgreens, used as the operating shell for FlipWork via d/b/a (Cory has not yet filed the d/b/a — see TODO list below).
- **Governing law / arbitration venue:** North Carolina (specifically Wake County for any court proceeding). Cory lives in Garner, NC.
- **Eligibility:** 18+ U.S. residents only. Service is intended for U.S. users only. No GDPR compliance built in. Children under 18 explicitly excluded.
- **Mandatory binding arbitration + class action waiver** under AAA Consumer Arbitration Rules. 30-day opt-out window for the user. Carveouts for small claims court and IP injunctive relief.
- **Independent contractor classification** of Workers is spelled out at length (Section 5 of TOS). Critical for gig-platform protection — Uber/DoorDash have been sued repeatedly on this exact point.
- **Limitation of liability:** $100 or 12 months of platform fees paid, whichever greater. Standard SaaS/marketplace cap.
- **User content license:** non-exclusive, royalty-free, sublicensable, transferable for purposes of operating the Service. Plain-English note included that Anthropic doesn't sell photos to advertisers or train general AI models on user data.
- **Email contact** in docs: `CoryThacker@proton.me`. No mailing address listed (says "available on request" — Cory hasn't set up a business address yet).
- **AI support chat disclosure**: Privacy Policy Section 3.1(b) explicitly discloses the support chat is powered by Anthropic's Claude Haiku, what data is sent to Anthropic, and that Anthropic doesn't train on API data by default.

### File map
- `legal/terms-of-service.md` — source of truth for TOS. ~10,500 words, plain-text formatted to display well inside `<pre>` tags. Edit this when you need to update the TOS.
- `legal/privacy-policy.md` — source of truth for Privacy Policy. ~7,000 words. Edit this when you need to update privacy.
- `scripts/generate_legal_sql.py` — regenerates the SQL migration from the two `.md` files. Run after editing either `.md`. Uses `$LEGAL$` dollar-quote tag (Postgres syntax that bypasses string escaping) — the script asserts the tag doesn't appear in the content before writing.
- `supabase/schema_legal_agreements_v1.sql` — generated SQL. Deactivates the original placeholder "Independent Contractor Agreement" seeded by `schema.sql` and inserts the new TOS + Privacy as required, active agreements (v1.0). Idempotent via `where not exists`.
- `supabase/schema_legal_agreements_public_read.sql` — small RLS patch. The original schema's SELECT policy required `auth.uid() is not null`, which blocked the public `/legal/*` pages for logged-out visitors. This patch drops it and replaces with `using (active = true)`. Admin-management policy on the same table is untouched.
- `app/legal/terms/page.tsx` and `app/legal/privacy/page.tsx` — thin wrappers that render `<LegalDocPage title="..." />`. Both `force-dynamic + revalidate=0` so admins can update text and see it live.
- `components/shared/LegalDocPage.tsx` — shared component. Loads the latest active version of a named agreement, displays it inside a card with a header bar (logo + Terms/Privacy nav). Fallback message if the agreement isn't in the DB (so the page never 404s during deploys).
- `lib/agreements-gate.ts` — exports `requireAgreementsAccepted(supabase, userId, currentPath)`. Call from any server page after `getUser()` returns a logged-in user. Internally fetches required+active agreements and the user's acceptances in parallel; redirects to `/auth/agreements?next=<currentPath>` if anything pending. Calls `redirect()` (Next's `next/navigation`) which throws, so no return-value handling needed at call sites.
- `app/marketplace/page.tsx` — only post-auth landing page currently wired to call `requireAgreementsAccepted`. The gate runs ONLY for logged-in users; logged-out visitors can still browse the marketplace freely.
- `app/auth/agreements/AgreementsClient.tsx` — bumped scroll-area height from `h-72` (288px) to `h-[60vh] min-h-[20rem]` so the new ~10k-word documents are actually readable. The component was already correctly designed to render one agreement at a time with a checkbox + version stamp + Accept button.

### Editing the legal text later
1. Edit `legal/terms-of-service.md` or `legal/privacy-policy.md`.
2. If it's a small fix-up that should NOT force users to re-accept, leave the version string as `1.0` at the top of both the `.md` file AND in `scripts/generate_legal_sql.py`. Run `python scripts/generate_legal_sql.py`. The regenerated SQL's `where not exists` check will see v1.0 still exists and skip the insert — so editing won't actually change the DB. You'd need to run a manual `update public.legal_agreements set content = $LEGAL$...$LEGAL$ where title = '...' and version = '1.0'` to push the change. **This is the safe path for typo fixes.**
3. If it's a material change that SHOULD force users to re-accept (e.g. new clauses, fee changes, jurisdiction changes), bump the version string to `1.1`, `2.0`, etc. in BOTH the `.md` file AND in `scripts/generate_legal_sql.py`. Re-run the script. The new row will insert as a new agreement, and since no user has an acceptance row for the new agreement_id, everyone gets caught in the gate on their next visit. The previous version stays in the DB as historical record (its `active` flag stays true unless you explicitly deactivate it). You may want to deactivate the old version in the same SQL run if you don't want it active.
4. Push the code, run the SQL, done.

### Public legal page SEO note
The public pages use `force-dynamic + revalidate=0` so they're fresh, but that ALSO means they're server-rendered on every request. For 99% of marketplaces, this is fine — search engines hit each page once and cache. If `/legal/*` ever becomes a hotspot for whatever reason, you could swap to `revalidate=3600` (refresh hourly) without losing much. The trade-off is staleness during the hour after an update.

### Quirks worth knowing
- **RLS gotcha:** the original schema's "Anyone authenticated can view active agreements" policy was the reason `/legal/terms` and `/legal/privacy` first shipped showing "document not available" — logged-out viewers literally couldn't read their own legal docs. The `schema_legal_agreements_public_read.sql` patch fixed it. If you ever recreate the table from scratch, use `using (active = true)` for SELECT, not `using (auth.uid() is not null and active = true)`.
- **The placeholder "Independent Contractor Agreement"** seeded by the original `schema.sql` is now `active = false`. Its acceptance rows in `user_agreement_acceptances` are still there (don't delete them — they're historical data), they just don't gate anything because the agreement is inactive. The IC language is now folded into Section 5 of the new TOS, so no separate IC agreement exists going forward.
- **Dollar-quote tags:** the generator uses `$LEGAL$` (Postgres custom tag). If you ever need to use a string containing `$LEGAL$` in legal text (extremely unlikely), the generator will refuse to write and ask you to pick another tag. Standard `$$` (no tag) would NOT have worked because `$$$$` would parse as an empty string followed by start-of-quote.
- **The gate is per-page, not middleware.** Reason: middleware runs on the Edge runtime, which doesn't have a fast path to the DB. Doing a DB hit on every single request to every protected route would slow the whole app. Only `/marketplace` is wired right now because it's the post-auth landing for everyone. If you add new high-traffic post-auth landing pages, wire `requireAgreementsAccepted` into those too. Otherwise it's a slow leak — a user who somehow skips marketplace can navigate around without ever being gated.
- **The `next=` parameter is preserved through the gate** by `app/auth/agreements/page.tsx` (it was already preserving this from previous work) and by `requireAgreementsAccepted` which forwards the current path as `next`. The agreements page sends users to the `next` URL after the last agreement is accepted. So a deep link → marketplace gate → agreements gate → original deep link works end-to-end.
- **Cory has NOT yet filed the d/b/a** with NC Wake County Register of Deeds. The legal docs reference "Groovy Greens, LLC, doing business as 'FlipWork'" as if the d/b/a already exists. This is fine for most purposes but technically the d/b/a needs to be on file to be fully clean. Cory was told this in the session and put on the non-code TODO list.
- **No real lawyer has reviewed the docs.** Cory was advised in the session to budget $200-400 for a small-business attorney spot-check before going live with real money. The docs match industry-standard marketplace TOS (Etsy/OfferUp/TaskRabbit patterns), so a review will mostly be tweaks. Don't take this off the TODO list until it's done.

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

## Marketplace as front door (SUPERSEDED — see "New landing page" below)

⚠️ **This was true for a while but is no longer the case.** A real marketing landing page now lives at `/` for logged-out visitors, and logged-in users land on `/home` (the dashboard) after login. The marketplace is still accessible — it's just no longer the auto-landing for anyone.

Keeping this section for context on the safe-`next` pipeline (which is still active and important).

Originally `/home` was the post-auth landing for logged-in users and `/` was a marketing landing page for logged-out users. For a phase, Cory wanted the marketplace front-and-center for everyone, with the dashboard demoted to "available via the hamburger nav but not a destination." That phase ended when Cory decided the marketplace was a confusing first impression for new visitors and asked for a real landing page that explains FlipWork. See "New landing page" section below.

### What changed (for the front-door era)
- **`/` redirected to `/marketplace` for everyone**, logged in or out. (NOW: `/` is the landing page, redirects logged-in users to `/home`.)
- **Logo linked to `/marketplace`** for workers/flippers. (NOW: logo links to `/home`.)
- **Post-auth landed on `/marketplace`** by default. (NOW: lands on `/home`.)
- **`?next=` is preserved through every auth path.** STILL TRUE — this is the part to actually carry forward. If a user lands on `/auth/login` or `/auth/signup` with `?next=/marketplace/<slug>`, that path survives:
  - login form → either branch respects `?next=` (with safety checks)
  - signup → onboarding → agreements (each forwards `?next=`)
  - Google OAuth: signup/login encodes `?next=` into the `redirectTo` URL going TO Google. `/auth/finishing` reads it back from `window.location.search` and POSTs it to `/api/auth/set-session`. `set-session` validates and uses it as the destination.
- **Middleware bounces to login WITH `?next=`.** STILL TRUE. Any protected-route hit without a session now redirects to `/auth/login?next=<original-path>` so the user lands back on their original destination after auth.

### Safety rules baked into every `safeNext` check (STILL TRUE)
- Must start with `/` (no external URLs)
- Must NOT start with `/auth` (would loop)
- Must NOT start with `/admin` (workers/flippers can't be redirected into admin-only pages)
- Admin login does the inverse: `?next=` only honored if it points at `/admin`.

### Key files touched (auth pipeline)
- `app/page.tsx` — root (NOW: landing page for logged-out, redirect to `/home` for logged-in)
- `app/auth/login/page.tsx` — reads `?next=`, honors it; default fallback now `/home`
- `app/auth/signup/page.tsx` — reads `?next=`, forwards to onboarding via query param; reciprocal sign-in link carries `?next=` too
- `app/auth/onboarding/page.tsx` — reads `?next=`, forwards to agreements
- `app/auth/agreements/page.tsx` — already honored `?next=`; default fallback is still `/marketplace` (intentional — agreements page should drop people somewhere they can do something, and `/marketplace` is fine here)
- `app/auth/finishing/page.tsx` — reads `?next=` from `window.location.search`, passes through `/api/auth/set-session` body
- `app/api/auth/set-session/route.ts` — accepts `next` in body, validates as safe; default fallback now `/home`
- `app/auth/login/actions.ts` (dead code) — kept consistent, default `/home`
- `components/shared/Nav.tsx` — `logoHref` is now `/home` for non-admins
- `middleware.ts` — bounce-to-login includes `?next=<original-path>` (UNCHANGED)

---

## New landing page (DONE — shipped this session)

Replaces the "marketplace as front door" era. `/` is now an actual marketing landing page that explains FlipWork. Logged-in users are redirected past it to `/home`; logged-out users see the pitch.

### Why
The marketplace feed (gray product cards with prices) was a confusing first impression for first-time visitors. New people landed on listings with no idea what FlipWork actually is — they couldn't tell if it was Facebook Marketplace, Etsy, or something else. The gig/labor side was completely invisible. Cory wanted a landing page that explains the two-sided nature of the platform and funnels people to sign up.

### What's there
- **Hero**: "Hire a flipper. Or become one." headline, supporting paragraph, two CTAs (Sign up free + Browse the marketplace)
- **How it works** — three-step explainer: Post or apply → Match and work → Get paid. Uses the existing `card` class and amber accent.
- **Two side-by-side cards**: "Got a piece to flip?" (for posters) and "Want to flip for money?" (for workers). Each has its own CTA with a `?as=` query param (flipper / worker) for future signup-flow branching if we want it.
- **Marketplace teaser** — small section linking to `/marketplace` so people who DID come for browsing aren't stranded.
- **Final CTA** + footer with Terms / Privacy links.

### Key file
- `app/page.tsx` — the entire landing page in one file. Server component. Reads the session and redirects to `/home` for logged-in users before rendering. Reuses `PublicTopBar` for the top nav (which already shows Log in / Sign up buttons for logged-out users), the existing `Button` component, and brand fonts/colors so the page feels native.

### Logo destination
- Logged-out logo → `/` (the landing page, via `PublicTopBar`)
- Logged-in non-admin logo → `/home` (the dashboard, via `Nav.tsx`'s `logoHref`)
- Admin logo → `/admin` (unchanged)

### Terms + Privacy in the logged-in nav
While in the area, also added a small `Terms · Privacy` row to the bottom of the hamburger menu (above Logout). Logged-in users previously had no way to find the legal docs from inside the app. Side-by-side small-text style matches the landing page footer. The new landing page footer already had them.

### Quirks worth knowing
- **`?as=flipper` / `?as=worker` on the signup CTA links is just future-proofing.** The signup page doesn't read it yet. If you want to do role-aware signup copy, that's the hook. Otherwise it's harmless.
- **There's no app-wide footer for logged-in pages.** Deliberate. The Terms/Privacy links live in the hamburger menu instead. Modern apps generally drop the footer once you're inside.
- **Don't add a logged-in footer "for completeness" without checking with Cory first.** It was a deliberate decision to keep the app layout clean.

---

## Marketplace as front door — original section (for reference only)

(See above. Section preserved here only because the auth pipeline notes still apply.)

---

## DEPRECATED — old manual-PayPal payout planning

⚠️ The whole "polish manual PayPal" plan from the prior session is dead. We pivoted to Stripe Connect (above). The two scoping questions about "money flow" and "which gaps to fix" were answered:
1. Money flow: flipper → platform → worker
2. Gaps: full polish — but via Stripe Connect, not by improving manual PayPal tracking

The legacy `payout_records` columns (`payout_status`, `payout_reference`, `payout_date`) still exist and are still wired to the existing admin/worker payout UIs. They'll get replaced as Phases 5-6 ship. Don't delete the legacy columns until live transactions are running on Stripe.

---

## ⚠️ TODOs left at end of session

1. **Rotate `SIGHTENGINE_API_SECRET`** — exposed in chat in an earlier session. Regenerate in Sightengine dashboard, update Vercel env var, redeploy. STILL OUTSTANDING — Cory has not done this yet across multiple sessions. **See "Cory's non-code TODOs" #5 for step-by-step.**
2. **Stripe Connect Phases 5, 6, 8, 9** — Phases 1-4 + 7 are done. Still needed before going live:
   - Phase 5: worker payout UI polish (Express dashboard login link, arrival window, Stripe-side status)
   - Phase 6: admin payout UI upgrade (show PI ID, status, refund button)
   - Phase 8: edge cases (declined cards at capture, restricted Connect accounts, expired auths, post-capture refunds)
   - Phase 9: go-live (swap to live keys, new webhook destination in live mode, $1 real-money smoke test)
3. ~~**AI support chat**~~ ✅ DONE this session. Haiku 4.5 agent at `/support`, with 5 tools (`get_my_gigs_posted`, `get_my_applications`, `get_my_payouts`, `get_my_stripe_status`, `escalate_to_admin`). Admin queue at `/admin/support` with escalated-count badge on `/admin`. See "AI support chat" section below.
4. **Place `ReportImageButton` on photo views** — gallery cards, gig photo grids, avatar viewers. Component is built; just needs to be slotted in.
5. **Listing reports — Report button + admin queue.** `listing_reports` table exists from this session's SQL. Need a "Report listing" button on the marketplace listing detail page, a `/api/report-listing` endpoint, and an admin queue page at something like `/admin/listing-reports`. Parallel to the existing `image_reports` infrastructure — should copy that pattern.
6. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.
7. ~~**Legal/TOS work**~~ ✅ DONE this session. Full TOS + Privacy Policy v1.0 shipped. Source markdown in `legal/*.md`, generator at `scripts/generate_legal_sql.py`, SQL at `supabase/schema_legal_agreements_v1.sql` (run) and `supabase/schema_legal_agreements_public_read.sql` (run). Public pages at `/legal/terms` and `/legal/privacy`. Existing logged-in users gated via `lib/agreements-gate.ts` wired into `app/marketplace/page.tsx`. See "Legal docs (TOS + Privacy)" section above. **Non-code follow-ups remain in the "Cory non-code TODOs" section below.**
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

## 📋 Cory's non-code TODOs (walkthrough — read this!)

These are things Claude CAN'T do for you. They matter for the legal protection your TOS/Privacy Policy promises. Take them in order — the lawyer review can happen anytime, but the LLC and d/b/a items should happen sooner than later.

### 1. Confirm Groovy Greens, LLC is in good standing — DO THIS FIRST (5 min, free)

Why it matters: your TOS names "Groovy Greens, LLC" as the operator. If the LLC is "administratively dissolved" by the state (which happens automatically if you miss an annual report), it legally doesn't exist right now and the TOS protection is much weaker. Easy to check.

**Steps:**
1. Open browser → go to **sosnc.gov** (NC Secretary of State)
2. Click **Search** in the top nav → **Business Registration**
3. Type "Groovy Greens" in the company name field
4. Click your LLC in the results
5. Look at the **"Status"** field

**If status is "Current-Active":** you're good. Move to #2.

**If status is "Administratively Dissolved" or anything not "Current-Active":**
- Click the **"Annual Report"** button on the same page
- Pay any outstanding annual reports (NC LLCs owe one every year by April 15, $200 each)
- If past-due multiple years, NC may require a "Reinstatement" — there's a button on the page for that ($100 reinstatement fee + back annual reports). Total cost depends on how many years you missed.
- Wait for the state to process it (usually same-day for online filings, can take a few days)
- Once status shows "Current-Active," continue to #2

If you're unsure, call NC SOS at 919-814-5400. They're helpful.

### 2. File a NC Certificate of Assumed Name (d/b/a) for "FlipWork" (~$26, 15 min)

Why it matters: your LLC is named "Groovy Greens, LLC" but everything customers interact with is called "FlipWork." Without a filed d/b/a, if a customer sues, they might claim "FlipWork" isn't a registered name and the contract (your TOS) doesn't legally apply. The d/b/a fixes that for ~$26.

**Steps:**
1. Open browser → go to **sosnc.gov/online_services** → "Assumed Business Name"
   - OR if that's confusing: Google "NC Certificate of Assumed Name online filing"
2. You'll fill out a form with:
   - **Assumed Business Name:** `FlipWork`
   - **Real Name of the Business:** `Groovy Greens, LLC`
   - **County where you'll operate:** Wake County (Garner is in Wake County)
   - **Type of Entity:** LLC
   - **Address:** your business address (your home is fine if you don't have a separate one — but be aware this becomes public record)
   - **Effective date:** today's date is fine
3. Pay the $26 filing fee with a credit card
4. Submit. You should get a confirmation email and a stamped copy within a few days.

**After filing:** save the stamped certificate PDF somewhere safe (Google Drive, Dropbox, etc.). If a payment processor or bank ever asks for proof you can operate as "FlipWork," that's the document.

**Important note:** in NC, the Certificate of Assumed Name is filed at the **state level via SOS** (this used to be county-level Register of Deeds before 2017). Don't get tripped up by old advice telling you to go to the courthouse — the state online system is current.

### 3. Update your business setup AFTER the d/b/a is filed (10 min)

Once you have the d/b/a certificate in hand:

- **Stripe account name:** Sign into Stripe Dashboard → Settings → Business Settings → Public Details. If it currently says your personal name or "Groovy Greens, LLC," update the **"Public business name"** to `FlipWork`. The legal entity stays as Groovy Greens, LLC, but the customer-facing name is what shows on credit card statements and Stripe Express dashboards.
- **Bank account (optional but recommended):** if you don't already have a business bank account for Groovy Greens LLC separate from your personal money, open one. Most local banks and online options (Mercury, Relay, Bluevine) let you open free business checking with the LLC formation docs + the new d/b/a. This is the SINGLE biggest thing protecting your LLC veil — mixing personal and business money is the #1 way courts pierce LLCs.

### 4. Get a small-business lawyer to spot-check the TOS + Privacy Policy ($200-400, 1 hour) — DO THIS BEFORE TAKING REAL MONEY

Why it matters: the legal docs Claude generated are based on what real marketplaces use (Etsy, OfferUp, TaskRabbit patterns), but Claude is NOT a lawyer and can't guarantee enforceability. A real attorney will:
- Spot anything material to NC law that Claude missed
- Tell you whether the arbitration clause + class action waiver will hold up in NC courts (they generally do, but state law evolves)
- Flag anything that wouldn't survive specifically for your business model
- Often suggest 2-3 small tweaks that meaningfully strengthen the docs

**How to find one cheaply:**
- **NC Bar Association lawyer referral service:** ncbar.org → "Need a Lawyer" → "Lawyer Referral Service." They'll match you with a small-business attorney in NC. First consult is often $50 for 30 minutes.
- **Avvo or LegalMatch:** search "small business attorney Raleigh" or "internet law attorney NC." Lots of solo practitioners do flat-rate document reviews for $200-400.
- **Ask local entrepreneur friends.** Someone you know has used one.

**What to tell the lawyer:**
> "I'm operating a small online marketplace platform under a NC LLC with a d/b/a. I have a Terms of Service and Privacy Policy that I drafted using a template. Can you review them for ~$300 and flag anything material I should change, especially around binding arbitration enforceability in NC and the independent-contractor classification of users who perform paid work?"

**Files to send them:**
- `legal/terms-of-service.md`
- `legal/privacy-policy.md`
- Tell them the live versions are at `https://myflipwork.com/legal/terms` and `https://myflipwork.com/legal/privacy`

**When they come back with changes:** just paste their suggested edits to Claude in a future session and Claude will make the updates, regenerate the SQL, and walk you through the deploy.

### 5. (Future) Rotate the Sightengine API secret (5 min)

This has been on the TODO list for multiple sessions. Quick task:
1. Sign into the Sightengine dashboard
2. Generate a new API secret
3. Update the `SIGHTENGINE_API_SECRET` env var on Vercel (Project → Settings → Environment Variables)
4. Redeploy the latest production build (Deployments tab → ⋯ → Redeploy → uncheck "Use existing Build Cache")
5. Done

Reason: the old secret was exposed in a chat session a while back. Almost certainly fine but rotating is cheap.

### 6. (Future) Set a business address on the legal docs

The TOS currently says "(Mailing address available on request)" because you don't have a separate business address yet. Once you have:
- A PO Box (NC USPS PO boxes are ~$70/year for a small one), OR
- A virtual mailbox service (iPostal1, Anytime Mailbox, etc., ~$10-15/month), OR
- An office/coworking space

…tell Claude the address and we'll update the legal docs. NOT urgent, but nice to have on the docs eventually.

### What you DON'T need to do

- **Don't form a separate "FlipWork LLC."** Groovy Greens, LLC + d/b/a "FlipWork" is exactly the right structure. Forming another LLC just creates an extra entity to maintain.
- **Don't try to "convert" Groovy Greens, LLC to a different name.** NC technically allows it but it's expensive and unnecessary — the d/b/a covers the customer-facing branding.
- **Don't pay a lawyer to draft TOS from scratch.** The docs Claude generated are already 80-90% there. A 1-hour review is the right spend, not a 5-figure custom drafting engagement.

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
- **⚠️ OPEN BUG (left at end of session): marketplace card thumbnails show blank gray boxes on `/marketplace`** for at least 3 listings that DO have photos uploaded. The detail page for those same listings (`/marketplace/<slug>`) renders the photos fine. So photos exist in `marketplace_photos`, the storage bucket public-URL flow works, RLS allows public reads (`status in ('active', 'sold')`) — but the listing-page batched query somehow isn't surfacing them. Schemas and queries between `/marketplace` and the detail page look identical. A diagnostic `console.log('[marketplace] photo query', ...)` is currently in `app/marketplace/page.tsx` to dump `requested_listing_ids`, `returned_photo_count`, and the first few rows. Next session: get Cory to load `/marketplace` while logged in, then read the Vercel function logs to see what Supabase actually returns. Most likely culprits: (a) a sneaky type mismatch between `listing.id` and `marketplace_photos.listing_id` in the `.in()` filter, (b) some pre-existing data state where photos are orphaned to listings that aren't in the visible top-60, (c) something weird about the `.order('sort_order')` + tied `sort_order=0` values changing the result set. Remove the diagnostic log once fixed.

---

## What's next (next session)

**This session: launch-prep UX cleanup — new landing page, post-auth routing, legal links in nav.** Four commits, no schema changes, no SQL. All focused on making the app's front door explain itself to first-time visitors.

1. **Real marketing landing page at `/`.** Replaces the "redirect to /marketplace" front door that's been in place for a few sessions. The marketplace feed was a confusing first impression for new visitors — they couldn't tell what FlipWork even did. New page has a hero ("Hire a flipper. Or become one."), a 3-step "How it works", side-by-side "for posters / for workers" cards, a marketplace teaser, and a final CTA. See "New landing page" section above for the full file map.
2. **Post-login destination flipped from `/marketplace` → `/home`.** Three files (email login server action, client login page, OAuth set-session route). `?next=` safe deep-links still take priority — only the no-next fallback changes.
3. **Logged-in nav logo points to `/home`** instead of `/marketplace`. Matches the new landing flow (logo = take me home, where "home" is wherever you start after login). Admin logo unchanged.
4. **Terms + Privacy links added to the logged-in hamburger menu.** Logged-in users previously had no way to find the legal docs from inside the app. Small side-by-side `Terms · Privacy` row at the bottom of the dropdown above Logout. Same visual style as the landing-page footer.

**Diagnostic temporarily added:** `app/marketplace/page.tsx` has a `console.log('[marketplace] photo query', ...)` to debug the open card-thumbnail bug (see "Watch out for" entry). Remove once that's fixed.

**Pattern carry-over for next session:** the landing page is single-file (`app/page.tsx`, ~230 lines) on purpose — easier to iterate. If it grows, split into section components in a `components/landing/` folder. Don't add an app-wide footer to logged-in pages without checking with Cory — that was a deliberate "modern apps drop the footer" call.

**Roadmap signal worth remembering:** Cory mentioned wanting `/home` to become a real social feed (posts, follow/follower, activity feed, groups, before/after threads). That's a future direction — NOT a "next sprint" item, but worth keeping in mind when touching `/home`. The current dashboard architecture is fine for now; the social-feed pivot would be a meaningful rebuild.

---

**Two sessions ago: launch-prep cleanup + full TOS/Privacy Policy v1.0 shipped.** Three commits, focused on closing one of the two biggest pre-launch blockers (legal docs) plus a repo-hygiene cleanup:

1. **Cleaned up 23 empty junk files** at the repo root that had been there since `9b1d2b2` (the worker city filter commit). Pure mechanical fix. Verified via `git show` that all were 0 bytes from creation, never had content. Single commit: `85c2f24`.
2. **Full TOS + Privacy Policy v1.0 shipped end-to-end.** Source markdown in `legal/*.md`, generator at `scripts/generate_legal_sql.py`, SQL migrations, public read pages at `/legal/terms` and `/legal/privacy`, and runtime gate wired into `/marketplace` so existing logged-in users get caught. See "Legal docs (TOS + Privacy)" section. Also generated the **Cory's non-code TODOs walkthrough section** with step-by-step instructions for the NC LLC good-standing check, NC d/b/a filing, Stripe business name update, and lawyer review.
3. **Hot-fix:** when Cory first visited `/legal/terms`, the page showed "document not available." Root cause was the original schema's RLS policy requiring `auth.uid() is not null` for SELECT — blocking logged-out viewers from reading public legal docs. Patched via `supabase/schema_legal_agreements_public_read.sql`. Cory ran the SQL and both pages now render correctly.

**Pattern carry-over from that session:** the source-markdown-to-DB-via-generator pattern (`legal/*.md` → `scripts/generate_legal_sql.py` → `supabase/schema_legal_agreements_v1.sql` → DB row) is a clean way to keep large blocks of content versioned in git AND in the DB. Could be reused for support FAQs, email templates, or anything else that's "text in the DB but humans want to edit it like a file."

---

**Three sessions ago: small focused UX polish around gig previews — no new systems, no schema changes, no SQL.** Four commits, all in `/gigs` and `/flipper/dashboard` territory:

1. **Reference images now visible on the flipper side too.** The flipper dashboard list shows a 64px thumbnail per gig (first image by `sort_order`, placeholder icon if none). The flipper gig detail page renders the full reference-image grid using the existing `GigReferenceImages` component. Image URLs are built on the server in one batched query.
2. **Own posted gigs now appear in the worker browse feed**, mixed in by date with everyone else's, marked with a small "Your post" badge under the status pill. Footer link reads "View as worker" on own posts. The existing `isOwnPostedGig` branch on `/gigs/[slug]` already prevents claiming and shows a "You posted this gig" panel, so no extra detail-page work was needed. Cory wanted this so he can see his gig the way workers see it without using a second account.
3. **Checklist preview attempt** — added a full task-list preview to each browse card, Cory looked at it and asked to back it out (he wanted the checklist visible only on the detail page next to the description, not duplicated on every card). The detail page already shows the checklist. Net: card stayed compact, change was a no-op for users.

**Pattern carry-over from that session:** batch-fetching related rows (images, checklist items, etc.) for a list of gigs in a single query and grouping by `gig_id` is a much better pattern than the client-side N+1 fetch `GigListingCard` does for thumbnails on the worker browse cards. That worker-side N+1 is still there (each card runs its own thumbnail query in a `useEffect`). Not urgent — perf has been fine — but if `/gigs` ever gets slow, that's where to start.

---

**Four sessions ago: killed two major iPhone bugs** — the photo upload hang and the OAuth hang. See "Older commits" and the bugfix notes below for details. Tl;dr: Vercel 4.5MB body limit triggered 413s that returned non-JSON HTML, crashing every `res.json()` call silently. Fix was client-side image compression + try/catch around every res.json(). And Supabase Site URL was set to the vercel.app domain, which made OAuth redirect through the `*.vercel.app → myflipwork.com` 308 — and 308s strip URL fragments, so the auth token vanished. Fix was setting Supabase Site URL to `https://myflipwork.com` directly.

---

**Marketplace is no longer the front door.** A real marketing landing page is in place at `/`, logged-in users land on `/home`. The marketplace is accessible via nav/CTAs but no longer the auto-landing for anyone.

**Marketplace messaging is live end-to-end** and **payments have their safety net** (Stripe Connect Phase 7 webhooks). Phases 5, 6, 8, 9 still needed before going live with real money.

**Streak counter** was pitched but deferred again — would require a new `user_activity_log` table with triggers backfilling events from claims/payouts/messages/gigs, plus a streak counter and richer activity feed on `/home`. Still the obvious "addicting to check" next move for the dashboard if Cory ever wants it — though note that Cory has signaled a bigger pivot for `/home` (social feed direction) that would supersede this.

Cory's most likely next moves, in rough order:

0. **Close out the open marketplace image bug** (see "Watch out for" entry). The diagnostic log is already in place; just need Cory to load the page logged-in and grab the Vercel function logs. Should be a 30-min fix once we see the actual returned data shape.

1. **Mutual cancel for gigs + tighten hard delete.** Known safety hole shipped a previous session: a claimed gig can be hard-deleted even when a worker is mid-claim (as long as no Stripe money has moved). Plan is to build an Upwork/TaskRabbit-style mutual cancel (either side requests, the other accepts/declines via system message in chat, claim → `cancelled_by_mutual_agreement`, Stripe auth released), and at the same time block hard delete when any claim is in `pending`/`active`/`submitted_for_review`. Full plan + file touches are in the TODOs section above (#12).

2. **Email notifications** (Bucket 1 #1 — MARKETPLACE_ROADMAP.md). Right now if someone applies to your gig or messages you, you have no idea unless you log in. Needs an email provider (Resend / Postmark / SES). Resend is recommended for simplicity — they have a generous free tier (~100 emails/day forever, no card required) and Next.js-friendly SDK. Templated sends for: gig claimed, gig submitted for review, work approved, payment received, listing message received. High-impact for retention.

3. **Stripe Connect Phase 9: Go-live.** Swap test keys → live keys, redo the webhook destination in LIVE mode in Stripe (test-mode destinations don't carry over — Cory needs to make a second one and put the live `whsec_...` in Vercel), one real $1 transaction to verify, monitor. **Should not happen until at least the d/b/a is filed and the lawyer has reviewed the TOS — see "Cory's non-code TODOs" section.**

4. **Back button on Step 2 of Post a Gig flow.** Cory asked for this two sessions ago, asked the clarifying "what should back do" question (option A = back to Step 1 same flow, option B = route to Edit Gig page), then deferred — "skip this for now, focus on the photo delete bug first." Never got back to it. Same pattern as the List an Item back button shipped two sessions ago (`1b9a0c0`) — Step 1 already creates the gig, so coming back needs to switch save from create → update. Reference that commit for the pattern. Cory's preference was unstated; ask before building.

5. **Marketplace location filter v2: zip-based + 100-mile radius.** A previous session shipped exact-city-match only. The full plan is zip-based: add `zip` to `worker_profiles`, `flipper_profiles`, and `marketplace_listings`; build a zip → lat/long lookup; show "within 100 mi of {zip}" with toggle. For logged-out users, prompt for zip and store in localStorage. Will naturally cover the logged-out marketplace location case too (currently they see all 60 most recent listings nationwide).

6. **Show available gigs in the marketplace feed.** Cory wants a toggle (like the Free only pill) to mix gigs into the marketplace view. Deferred a previous session because there's no real data yet to design against. Decisions still open: how the toggle works (items/gigs/both vs. either/or), whether to show gigs to logged-out users (they can't apply without Stripe Connect — discovery vs. bounce tradeoff), and how to make gig cards visually distinct from listing cards.

7. **Listing reports — Report button + admin queue.** Table exists, button + admin UI don't. Mirrors the existing `image_reports` flow.

8. **Stripe Connect Phase 5: Worker payout UI polish.** Show Stripe Express dashboard login link on `/my-gigs/payouts`, show expected payout arrival window, surface Stripe-side status (Pending / In transit / Paid) instead of legacy "unpaid/pending/paid."

9. **Stripe Connect Phase 6: Admin payout UI upgrade.** Show stripe_payment_intent_id, payment_status, capture/refund buttons on the admin payouts page. With webhooks in place (Phase 7 done), this is much more useful.

10. **Stripe Connect Phase 8: Edge cases.** Flipper's card declines at capture time, worker's Connect account gets restricted after approval, auth expires before work is done, flipper requests refund after capture, gig is canceled after authorization. Webhooks now detect most of these; the work here is the UI/notification side.

11. **`/home` social feed pivot** — Cory's signaled direction for the dashboard. NOT a near-term task, but worth tracking. Would involve: posts/feed table, follow/follower relationships, activity feed pulling from claims/payouts/messages/gigs, possibly groups (by city or style?). This would supersede the "streak counter + activity log" task that's been on the backlog for several sessions. When this becomes real work, do design discussion FIRST — it's a meaningful rebuild of the post-auth experience.

12. **Address/pickup details on gigs** (Bucket 1 #3) — paired with messaging; reveal-after-pick.

13. **Ratings/reviews** (Bucket 1 #4).

14. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.

15. **Rotate `SIGHTENGINE_API_SECRET`** — overdue across multiple sessions. Two-minute task. See "Cory's non-code TODOs" #5.

16. **Place `ReportImageButton`** on photo views (gig and marketplace).

17. **Dashboard discoverability micro-fix on `/flipper/dashboard`.** The current flipper-specific dashboard has no signal for "work submitted, awaiting your review." The "Pending applicants" tile only counts pending claims. Lower priority since `/home` surfaces this via the "needs review" action card.

18. **"Payouts" nav link is worker-centric.** Currently shown to everyone; flippers hitting it see "$0 earnings" empty state. Either rename it, hide it for users with no payout history, or build a paired flipper-side "Payments you've made" view. Low priority — Cory was aware and laughed it off, but worth fixing eventually.

Cory will pick. Open by confirming what you're about to build in 2-3 lines, then build.

---

## This session's commits (most recent first)

- `56a5e77` Add Terms + Privacy links to logged-in hamburger menu: side-by-side `Terms · Privacy` row in `components/shared/Nav.tsx`, tucked between Support and Logout with a separator above and below. Small font, low-emphasis (`text-muted-foreground`), matches the landing-page footer style. Closes a real gap — logged-in users previously had no way to reach the legal docs from inside the app.
- `96b2a13` Logged-in nav logo points to `/home` instead of `/marketplace`: single-line change to `logoHref` in `components/shared/Nav.tsx`. Admin logo (`/admin`) unchanged. Matches the new "logo = home base" pattern now that `/home` is the post-login landing.
- `61f25ef` Add temporary diagnostic logs to marketplace photo query: server-side `console.log('[marketplace] photo query', ...)` in `app/marketplace/page.tsx` dumping `requested_listing_ids`, `returned_photo_count`, and the first 3 rows. Added because card thumbnails are blank on `/marketplace` for listings that DO have photos (detail page shows them fine). REMOVE after the bug is fixed. See "Watch out for" entry.
- `57dae08` Post-login destination: send users to `/home`, not `/marketplace`: three files (`app/auth/login/actions.ts`, `app/auth/login/page.tsx`, `app/api/auth/set-session/route.ts`). `?next=` safe deep-links still take priority — only the no-next fallback changes. The `agreements-gate.ts` fallback was deliberately left as `/marketplace` (it's a "drop them somewhere sensible after the gate" target, not a login destination).
- `986c159` New marketing landing page at `/` for logged-out visitors: replaces the bare `redirect('/marketplace')` that had been the front door. Logged-in users now redirect to `/home`; logged-out users see the new landing page. Sections: hero with "Hire a flipper. Or become one.", 3-step "How it works", two-sided "For posters / For workers" cards, marketplace teaser, final CTA, footer with Terms/Privacy. Reuses `PublicTopBar`, `Button`, and brand fonts/colors. Single-file (~230 lines) on purpose. See "New landing page" section above.

## Previous session's commits

- `7e91e09` Fix /legal/terms and /legal/privacy showing as 'not available': the original schema's RLS SELECT policy on `legal_agreements` was `using (auth.uid() is not null and active = true)`, which blocked logged-out visitors — but the whole point of public legal pages is that logged-out visitors can read them. Created `supabase/schema_legal_agreements_public_read.sql` which drops the auth-required policy and replaces with `using (active = true)`. Admin-management policy on the same table untouched. Cory ran the SQL and confirmed both pages now render.
- `6bceccd` Add full TOS + Privacy Policy v1.0 + public legal pages + agreements gate: the big one. ~10k-word Terms of Service + ~7k-word Privacy Policy seeded into the DB. Source markdown at `legal/*.md` (edit these to update), generator at `scripts/generate_legal_sql.py` (regenerates SQL from markdown using `$LEGAL$` dollar-quote tag), SQL migration at `supabase/schema_legal_agreements_v1.sql`. Public pages at `/legal/terms` and `/legal/privacy` via shared `components/shared/LegalDocPage.tsx` (force-dynamic, pulls from DB). New `lib/agreements-gate.ts` exports `requireAgreementsAccepted()` — wired into `app/marketplace/page.tsx` so existing logged-in users hit the gate naturally. Bumped agreement scroll area from `h-72` to `h-[60vh] min-h-[20rem]` so the new long docs are readable. Decisions baked in: Groovy Greens, LLC (NC) d/b/a FlipWork; NC governing law / Wake County venue; 18+ US-only; mandatory binding arbitration + class action waiver under AAA Consumer Rules with 30-day opt-out; strong independent-contractor classification for workers; $100 or 12-mo fees liability cap. See "Legal docs (TOS + Privacy)" section above for the full file map and editing instructions. See "Cory's non-code TODOs" section for the d/b/a filing walkthrough, LLC good-standing check, and lawyer review guidance.
- `85c2f24` Clean up 23 empty junk files at repo root: leftover from `9b1d2b2` (worker city filter commit) — JSX fragments like `setTitle(e.target.value)}` got somehow split out as filenames. All were 0 bytes from creation (verified via `git show 9b1d2b2`). Pure mechanical cleanup. No functional change.

## Two-sessions-ago commits

- `52aaf60` Teach support AI: use backticks for paths, not bold: live-testing the AI support chat showed it was emitting `**/profile/payments**` which markdown couldn't parse (asterisks wrapping text starting with `/` confuse the parser, so it rendered as literal asterisks). Added a "Formatting" section to the system prompt instructing the AI to use backticks for paths/UI references, save bold for actual emphasis, no markdown headers in chat replies, and short paragraphs. Single-file change to `lib/support-prompt.ts`.
- `21107bd` Render markdown in support chat bubbles: added `react-markdown@^10.1.0` + `remark-gfm@^4.0.1`. AI replies now render bold, lists, links (opens in new tab), code, blockquotes properly. User messages stay as plain text. Added `.chat-markdown` CSS class in `app/globals.css` to style markdown elements inside chat bubbles. Same renderer added to `/admin/support/[id]` so admin sees the same view users see.
- `d3c36ce` Add AI support chat agent (Haiku 4.5): full AI support feature — `/support` page for users, `/admin/support` queue for admin, 5 tools (4 read-only DB lookups + 1 escalation), system prompt teaching the agent FlipWork rules. New tables `support_conversations` + `support_messages` with RLS. Hard caps: 5 chats/day/user, 50 messages/chat. Added `@anthropic-ai/sdk@^0.98.0` dependency and `ANTHROPIC_API_KEY` env var on Vercel. Cory tested live in production with "how do i get paid?" and got a clean correct answer. See "AI support chat" section above.

### Note on Vercel deploy queue (from the AI-support-chat session)
Cory hit a deploy queue jam in that session — 4 commits in rapid succession stacked up behind a manual redeploy and stopped processing. Fix was to cancel the queued deploys via the `⋯` menu on each row and redeploy the latest commit. Vercel's free/hobby tier serializes builds (one at a time). LESSON for future sessions: batch related changes into fewer commits to avoid stacking the queue. Don't push 4 commits in 10 minutes.

## Three-sessions-ago commits

- `87f7a70` Remove checklist preview from browse-gigs card: backed out the checklist preview added two commits earlier. Cory wanted the checklist visible only on the gig detail page next to the description, not duplicated on every browse card. Cleanly removed the prop, the batch query in `app/gigs/page.tsx`, and the unused `ListChecks` / `Check` imports. Cards are back to compact mode.
- `99e6b6f` Show full checklist preview on each browse-gigs card: batch-fetched all checklist items for visible gigs in one query, grouped by `gig_id`, passed through `GigFilterContent` → `GigListingCard`. Card renders the full task list in a small muted box with task count header and required (*) markers. Shipped, then reverted by `87f7a70` after Cory saw it.
- `96e36bf` Show user's own posted gigs in browse, marked with 'Your post' badge: removed the `.or()` filter from `app/gigs/page.tsx` that hid own gigs. `GigListingCard` got an `isOwnPost` prop and shows a small "Your post" badge under the status pill when set. Footer link reads "View as worker" on own posts. The existing `isOwnPostedGig` branch on the gig detail page already prevents claiming and shows a "You posted this gig" panel with a button back to the flipper dashboard, so no extra work needed there.
- `f4a7513` Show gig reference images in flipper dashboard list + flipper gig detail: `/flipper/dashboard` now shows a 64px square thumbnail per gig (first uploaded reference image by `sort_order`, or a placeholder `ImageIcon` if none). One batched query fetches all images for visible gigs, then we pick the lowest sort_order per gig and build public URLs once on the server. `/flipper/gigs/[id]` now renders the existing `GigReferenceImages` component below the gig header card — same UI workers see.

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
