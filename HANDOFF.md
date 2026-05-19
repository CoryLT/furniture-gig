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

---

## Messaging system

Bucket 1 #2. Note: with the application/approval flow refactor (this session), there is now ONE conversation per (gig, applicant) rather than one per gig. See that section for the details.

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

## Self-claim bug fix (NEW this session)

Cory noticed users could claim their own gigs. Three layers of fix:

1. **`app/gigs/page.tsx`** — browse list excludes gigs where `poster_user_id` OR `created_by` matches the user.
2. **`app/gigs/[slug]/page.tsx` + `ClaimButton.tsx`** — if viewer posted this gig, show "You posted this gig" with a button to the dashboard instead of a Claim button.
3. **`supabase/schema_prevent_self_claim.sql` (already run)** — DB trigger refuses INSERT/UPDATE on `gig_claims` if `worker_user_id` matches the gig's poster. Also cleans up any pre-existing self-claims and resets affected gigs from `claimed` → `open`.

---

## Application/approval flow (DONE — shipped this session)

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

## Image moderation (DONE — shipped this session)

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

## ⚠️ TODOs left at end of session

1. **Rotate `SIGHTENGINE_API_SECRET`** — exposed in chat. Regenerate in Sightengine dashboard, update Vercel env var, redeploy.
2. **Place `ReportImageButton` on photo views** — gallery cards, gig photo grids, avatar viewers. Component is built; just needs to be slotted in.
3. **Worker `/my-gigs/[claimId]` "not picked" state** — when a worker's application was rejected, they currently still see the full checklist UI.
4. **Legal/TOS work** — started but didn't finish (Cory paused to handle moderation first). Decisions already made:
   - Source: generated starter text (lawyer-review-before-launch disclaimer at top)
   - Gate: hard gate — must accept before doing anything
   - Existing infra at `/auth/agreements` already handles multiple required agreements; just needs TOS + Privacy seed and a server-side check that redirects logged-in users with unaccepted required agreements to `/auth/agreements`. A SQL file (`supabase/schema_legal_agreements.sql`) was scaffolded but not completed. Restart fresh.

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

See `MARKETPLACE_ROADMAP.md` for the full picture. Cory's most likely next moves:

1. **Finish the moderation work** — rotate the leaked Sightengine secret, place `ReportImageButton` on photo views. Probably the first thing he'll want.
2. **Terms of Service + privacy policy** — Bucket 1 #5. Cory wants to do this; was paused mid-session. See TODO #4 above.
3. **Address/pickup details on gigs** — Bucket 1 #3. Smaller in scope; visible to approved worker only.
4. **Email notifications** — Bucket 1 #1. "You were picked / rejected / paid" emails. Useful for off-platform engagement.
5. **Ratings/reviews** — Bucket 1 #4.

Cory will pick. Open by confirming what you're about to build in 2-3 lines, then build.

---

## This session's commits (most recent first)

- `e723561` Block uploads containing minors (face-attributes model)
- `1a8736a` Add image reports system + admin reports queue
- `1a4b05d` Add Sightengine moderation gate to all image uploads
- `a3962f6` Add Applications tab to My Gigs page
- `84acc4d` Flipper applicant list with Approve/Reject + per-applicant messaging
- `674e02b` Switch gig detail page from Claim to Apply (with applicant count)
- `cc27422` Add SQL migration for application/approval flow

## Previous session's commits

- `6d4e60a` Add realtime unread message badge to Messages nav link
- `fcd1052` Add /messages inbox page and Messages link to nav
- `88ea77e` Prevent users from claiming their own gigs (UI + DB trigger + browse filter)

---

Good luck. Cory is sharp, patient, and direct. Match that energy.
