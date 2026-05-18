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
- **Messaging (NEW this session)** — see below

---

## Messaging system (NEW — built this session)

Bucket 1 #2 is done. Everything is in place and working.

### What's there
- **`/messages` inbox** — list of all conversations, sorted by recency, with unread badges per row and a total unread summary up top
- **`/messages/[conversationId]` chat page** — message bubbles, type-and-send composer, realtime delivery, "is typing" indicator (bouncing dots), read receipts ("Sent" / "Seen")
- **"Message Flipper" button** on worker's My-Gig detail page (`/my-gigs/[claimId]`)
- **"Message Worker" button** on each active claim in flipper's gig page (`/flipper/gigs/[id]`)
- **Realtime unread badge** in the top nav next to "Messages" — ticks up when new messages arrive on ANY page (not just the inbox), ticks back down when read
- **"Messages" link** in top nav (between "My Posted Gigs" and "Payouts")

### Key DB tables (in `supabase/schema_messaging.sql` and `schema_messaging_patch_poster.sql` — already run)
- `gig_conversations` — one row per gig (UNIQUE on gig_id). Stores `flipper_user_id`, `worker_user_id`, `last_message_at`. RLS allows only the two participants to read/insert/update.
- `gig_messages` — actual messages. Stores `conversation_id`, `sender_user_id`, `body`, `read_at`, `created_at`. RLS: participants can SELECT and INSERT; recipients can UPDATE read_at on messages they did NOT send.
- A trigger on `gig_claims` INSERT auto-creates the conversation when status is `active`. Uses `coalesce(poster_user_id, created_by)` for the flipper. Backfill already ran for existing claimed gigs.
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

## Self-claim bug fix (NEW this session)

Cory noticed users could claim their own gigs. Three layers of fix:

1. **`app/gigs/page.tsx`** — browse list excludes gigs where `poster_user_id` OR `created_by` matches the user.
2. **`app/gigs/[slug]/page.tsx` + `ClaimButton.tsx`** — if viewer posted this gig, show "You posted this gig" with a button to the dashboard instead of a Claim button.
3. **`supabase/schema_prevent_self_claim.sql` (already run)** — DB trigger refuses INSERT/UPDATE on `gig_claims` if `worker_user_id` matches the gig's poster. Also cleans up any pre-existing self-claims and resets affected gigs from `claimed` → `open`.

---

## ⚠️ Big planned refactor: Application/Approval flow (NOT STARTED)

**Cory wants to replace the "first-to-claim wins" model with an application/approval flow.** This is intentionally parked for a future instance because it touches a lot — the gig flow, the messaging trigger, the admin review flow, and probably the worker dashboard.

### The desired flow
1. Flipper posts gig (unchanged)
2. Multiple workers APPLY (no lock at this point)
3. Flipper reviews applicants in their dashboard
4. Flipper picks one → that worker is approved, others get rejected
5. NOW the gig is locked to the approved worker, and the existing "My Gigs" / checklist / submit flow takes over

### Already-decided design (from Cory in this session)
- Messaging is gig-tied only (one conversation per gig — same as today)
- Messaging opens BETWEEN applicants and flipper BEFORE a pick is made (lets flippers screen) — wait, actually re-check this one. He picked "open as soon as someone applies (helps flippers screen)" — yes, that one. Edit: he switched contexts and parked this whole thing so he didn't lock the second decision. Confirm both with Cory before starting.
- TBD: whether applicants see how many others applied

### Implementation hints for whoever picks this up
- Repurpose `gig_claims` with a new `pending` status, or add an `applications` table. Pros of repurposing: less new schema, less code duplication. Cons: the existing UNIQUE constraint on `gig_claims.gig_id` blocks multiple applications — that needs to be relaxed.
- The messaging auto-create trigger (`create_conversation_on_claim`) currently fires when a claim is `active`. With the new flow, decide whether conversations should auto-create on `pending` (so flipper-applicant chat works) or only on approval.
- Flipper dashboard's claim list (`app/flipper/gigs/[id]/page.tsx`) needs an "Approve" / "Reject" UI for each applicant.
- Already in production: per-gig conversations, "Message Worker" buttons. Those WILL need to be revisited — likely the button moves from "the active claim" to "each applicant," with messaging available pre-pick.
- DB-level guard: the `prevent_self_claim` trigger should keep working since it checks `worker_user_id` against poster regardless of status.

### What Cory will probably say to start
> "Switch the claim flow to an application/approval flow. Workers apply, flipper picks one. See the handoff doc."

When he does, confirm BOTH of the design decisions above (pre-pick messaging? applicant count visibility?) before writing any code.

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
- **Gig schema has BOTH `poster_user_id` AND `created_by`.** `post-gig/PostGigForm.tsx` fills both. App code reads `poster_user_id`. SQL triggers use `coalesce(poster_user_id, created_by)` for safety. Use the same pattern if you write new SQL.
- **He's on Max plan.** Use the context you need, but don't be wasteful.

---

## What's next (next session)

See `MARKETPLACE_ROADMAP.md` for the full picture. Top options:

1. **Application/approval flow refactor** — the biggest deferred item, see section above. Confirm design decisions first.
2. **Address/pickup details on gigs** — Bucket 1 #3. Smaller in scope; couples with messaging nicely (address visible after worker is approved).
3. **Email notifications** — Bucket 1 #1. "Your gig was claimed/applied to/approved/paid" emails. Useful for off-platform engagement.
4. **Ratings/reviews** — Bucket 1 #4.
5. **Terms of Service + privacy policy** — Bucket 1 #5. Mostly content work + simple gating UI.

Cory will pick. Open by confirming what you're about to build in 2-3 lines, then build.

---

## This session's commits (most recent first)

- `6d4e60a` Add realtime unread message badge to Messages nav link
- `fcd1052` Add /messages inbox page and Messages link to nav
- `88ea77e` Prevent users from claiming their own gigs (UI + DB trigger + browse filter)
- `89aa283` Add Message buttons to worker and flipper gig pages + find-or-create API
- `68089d4` Add /messages/[conversationId] chat page with realtime and typing indicator
- `a217ec3` Add messaging schema (gig_conversations + gig_messages) and types

---

Good luck. Cory is sharp, patient, and direct. Match that energy.
