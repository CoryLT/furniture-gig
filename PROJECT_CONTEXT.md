# FlipWork — Project Context (Claude Project Instructions)

> This is the **standing context** for the FlipWork project. Paste it into the
> Claude Project Instructions so every new conversation starts from reality.
> It changes slowly. For "what we did last session" detail, read `HANDOFF.md`
> in the repo (it points to the newest dated `HANDOFF_*.md`) — that's the living log.
>
> Last rewritten: June 17, 2026 (session D), after shipping the "piece is the hub"
> direction. The big change from the prior version: the **Books ledger is now the
> single source of truth for every cost AND every worker payment**, and the
> **worker/gig + marketplace side is shelved** (operator-only). The old PayPal/Stripe
> notes and the on-platform "direct pay" handshake are gone — see Payments below.

---

## What FlipWork actually is (now)

A **hub / light resource-management ("tycoon") tool for one customer: the flipping
operator** — someone running a flipping business (furniture and anything else legally
flippable) who wants to source, fix, sell, and hire contract help without Craigslist
sketchiness or W-2 overhead. It started as a two-sided furniture-gig marketplace
("furniture-gig" is still the repo name) and a general flip marketplace; **both of
those are now shelved.** The operator does everything inside FlipWork themselves.

- **Brand:** FlipWork · **Repo:** `github.com/CoryLT/furniture-gig`
- **Live domain:** myflipwork.com (deployed on Vercel)
- **Operating entity:** Groovy Greens, LLC (NC), d/b/a FlipWork. NC governing
  law; binding arbitration + class waiver in the TOS.
- **Admin:** Cory (single admin). `/admin` is analytics + support queue only.
- **Front door:** logged-in users land on **`/play`** (the gamified home).

---

## Current direction (June 2026) — Operator Hub, operator-only

Focus is ONE user: the operator. The worker app, the gig marketplace, and the
item/services marketplace are **mothballed** (code still exists, reachable only by
direct URL; the menu entries are commented out). Monetization stays a pro/business
subscription (never a cut of payments); validate by dogfooding + micro-influencer
outreach before charging. Standing legal caution: the contractor model risks
worker-misclassification — route Cory to a NC employment/tax attorney. Not legal advice.

**The core loop the app supports:** source a piece → log what you paid → fix it
(log materials/labor) → list it → sell it → see profit and cash-tied-up. Hiring help
is just a labor expense on a piece, tagged to a person.

**The golden rule: log each thing ONCE, in the right place.**
- Purchase price → the Pipeline new-piece field (writes a ledger purchase txn).
- A single-piece cost (no receipt) → the piece's "Add expense."
- A multi-piece or general receipt → the Books **receipt scanner** (one photo, one
  line per item, each line tagged to a piece or left General, with a category).
- Paying a worker → a **Labor** expense on the piece, **tagged to a crew member**
  (this is what feeds Payment Records + the 1099 alert — see Payments).
- A business cost that isn't tied to a piece → Books "Log an expense," no piece.

### Operator features built
- **Dashboard `/play`** — gamified "tycoon" home: rank/score, momentum, challenges,
  cash-free vs tied-up, a pieces-by-stage board, interactive profit charts
  (`components/play/ProfitCharts.tsx`), and a **"Needs you"** board
  (`components/play/NeedsYou.tsx`) that surfaces real problems (no price, no photo,
  cash stuck ≥30 days). Plus a few utility cards (messages, business setup,
  notifications, add-to-home-screen).
- **Pipeline `/flipper/pipeline`** — pieces Sourced→Sold with photos, an expense
  ledger per piece, and a profit / cash-tied-up HUD. Each piece has a **"Find help"**
  ad generator (`components/pipeline/FindHelpCard.tsx`) — copy/paste text to recruit
  a hand off-platform.
- **Books `/books`** — the full double-entry ledger (the money truth). Charts,
  receipt scanner, and bank-feed **reconcile**.
- **My Crew `/flipper/crew`** — roster + private rating / notes / would-rehire,
  including **off-platform, name-only** people (no account). A worker's paid total
  and payment history are derived from the ledger (so they match everywhere).
- **Payment Records `/flipper/records`** — per-worker, per-year payouts derived from
  logged labor, with a year-correct 1099 flag ($600 ≤2025, $2,000 2026+) and CSV export.
- **Installable app + push** — PWA install to the home screen + Web Push (e.g. new
  message). On/off + a "test buzz" in Account Settings (`/profile`).

---

## Payments — the operator logs labor; the LEDGER is the truth

> The old on-platform "direct pay" handshake (worker saves a payout handle, operator
> picks, marks paid, worker confirms — `gig_payments`) is **shelved**, along with the
> earlier Stripe/PayPal processing. FlipWork never touches gig money.

- The operator pays workers however they already do (Cash App, Venmo, Zelle, cash),
  off-platform, then **logs it as a Labor expense on the piece and tags which crew
  member** they paid.
- `transactions.crew_member_id` tags a ledger expense to a crew member. The
  **`worker_payments` view** (one row per tagged expense) is THE per-worker pay
  source. Payment Records and the 1099 alert both read it.
- **1099 alert:** after a tagged labor expense, `/api/payments/check-1099` sums that
  worker's tagged labor for the year and fires once (in-app + push + email) when they
  cross the threshold. Notification type `1099_threshold`; name comes from
  `data.worker_name`.
- Untagged labor still counts as the piece's cost, just not per-worker.
- Dormant Stripe/PayPal/`gig_payments` code still sits in the repo (mothballed). The
  on-platform pay components (`PayWorkerCard`, `FlipperGigList`) are unreachable from
  the menu.

---

## Data model — the ledger is the cost truth

- **Books ledger = single source of truth for ALL costs and worker pay.**
  `accounts` (asset/income/expense/equity/liability) + `transactions` (date,
  description, memo, **piece_id**, contact_id, **crew_member_id**, receipt_path) +
  `entry_lines` (debit/credit, cascade-delete with the txn).
  - `piece_id` tags an expense to a piece; `crew_member_id` tags it to a worker.
  - Purchase price is a txn with memo `acq:<pieceId>` (legacy `mig:acq:`).
- **Views:** `piece_costs` (per-piece total cost) and `worker_payments` (per-worker
  payments). Both `security_invoker`.
- **RPCs:** `add_piece_expense(p_piece_id, p_amount, p_category, p_note,
  p_crew_member_id)` and `set_piece_purchase(p_piece_id, p_amount)`. Helpers
  `_fw_expense_account`, `_fw_cash_account`. (These use `auth.uid()`, so they only
  work for a signed-in client, not SQL-editor migrations.)
- `piece_expenses` table = **RETIRED from live code** (kept as a backup; migrated into
  the ledger). `inventory_pieces.acquisition_cost / labor_cost / materials_cost` are
  legacy and ignored for cost math.
- `crew_members` (id, operator_user_id, worker_user_id [nullable = off-platform],
  worker_name, rating, notes, would_rehire, jobs_count, paid_total [now legacy],
  hidden). `inventory_pieces` (stages sourced→in_progress→listed→sold; source_gig_id;
  photos in public bucket `marketplace-photos`).
- `gig_payments`, gig/claim tables, marketplace tables, `worker_services` — all
  **legacy/mothballed**. `notifications` (type CHECK incl `1099_threshold`).
- `operator_business` is an unused orphan — drop when convenient.

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
6. **SQL is the ONE copy/paste exception.** Save SQL in `supabase/`, then give
   crystal-clear steps: "hard-refresh the raw file → copy all → Supabase → SQL
   Editor → New query → paste → Run." **Use uniquely NAMED dollar tags** (`$ape$`,
   `$mig$`, …) in functions — Supabase mis-parses repeated bare `$$`.
7. **GitHub raw pages cache hard.** If a re-pushed file looks stale, send the
   `raw.githubusercontent.com` URL and tell Cory to hard-refresh (Cmd/Ctrl+Shift+R).
8. Cory can do **basic** VS Code things (pull, push) but is NOT comfortable editing
   code. Keep anything you ask him to do dead simple.

---

## GitHub token + deploy flow

- Cory pastes a **fresh GitHub personal access token** into chat at the start of each
  session and revokes it after. **That revoke-after-session is the security model —
  do NOT suggest storing it anywhere, and do NOT lecture about token security.**
- Push from sandbox: `git push https://CoryLT:<TOKEN>@github.com/CoryLT/furniture-gig.git main`
- **Vercel does NOT auto-deploy from Claude's pushes.** After Claude pushes, Cory runs
  in VS Code: `git pull` → `git push`, then waits ~45–60s for Vercel. Cory's local
  push is what triggers the deploy.
- Pre-push check: `npx esbuild <file> --jsx=automatic --bundle=false
  --loader:.tsx=tsx --outfile=/dev/null` (`--loader:.ts=ts` for `.ts`).
  `git restore tsconfig.tsbuildinfo` before `git add`.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.1 (App Router) |
| Database / Auth / Storage | Supabase (Postgres) |
| Styling | Tailwind 3.3 + Radix UI primitives (manual shadcn-style); `darkMode:'class'` |
| Email | Resend (`lib/email.ts`, FROM `notifications@myflipwork.com`) |
| Image moderation | Sightengine (on all upload paths) |
| AI (support chat + receipt scan) | Anthropic (Haiku 4.5) |
| Deployment | Vercel |

- `next.config.js` has `ignoreBuildErrors` + `ignoreDuringBuilds` true, so TS/ESLint
  won't block a Vercel build. A local `next build` still catches real syntax errors.
- Fonts: DM Sans (body), DM Serif Display (headings), DM Mono.
- Color: warm neutral base, near-black primary, amber accent (`hsl(32 90% 48%)`).
  `/play` uses its own `--play-*` theme vars; standard screens use the base tokens.

---

## Load-bearing gotchas (read before editing)

- **The ledger is the cost truth.** Don't reintroduce `piece_expenses` reads. Costs
  read from the `piece_costs` view / ledger; worker pay reads from `worker_payments`.
  Write through the RPCs (`add_piece_expense`, `set_piece_purchase`).
- **Name columns are inconsistent (live bug source).** `full_name` is the
  going-forward column (the `unified-save` path writes it), but `first_name`/
  `last_name` still exist and ~25 files read them. Prefer `full_name`; treat
  first/last reads as suspect. `schema.sql` + `types/database.ts` are stale here.
- **`users` table RLS** lets a user read only their OWN row (admins read all). Don't
  add an "existence check" against `users` for another user — it false-fails.
- **SQL ordering:** if a policy references another table, create that table FIRST.
  **Named dollar tags** in functions (see workflow rule 6).
- **`/play` and `/home` are protected** — never send logged-out users there. Public
  landing is `/`. (`/home` just redirects to `/play`.)
- **iPhone HEIC uploads** can have an empty MIME type — use `looksLikeHeic()` /
  `isAcceptableImageFile()` in `lib/imageCompression.ts`, not `file.type`.
- **Vercel deploy** only fires on Cory's local `git push`.
- **`notifications`** has no client INSERT policy — insert via `createAdminClient`
  (service role) or a SECURITY DEFINER function. `type` has a CHECK constraint.

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_ADMIN_EMAIL=
RESEND_API_KEY=
NEXT_PUBLIC_SITE_URL=        (getSiteUrl() in lib/utils.ts prefers this)
ANTHROPIC_API_KEY=           (AI support + receipt scan)
SIGHTENGINE_*=               (image moderation)
```
(Plus dormant Stripe/QuickBooks keys still referenced by mothballed code.)

---

## What's next (candidates, not committed)

- Switch the crew-card "jobs" count to a ledger **payments** count (only the $ amounts
  are unified today).
- Optionally pull historical on-platform `gig_payments` into Payment Records (it reads
  `worker_payments` only now).
- Retire the `piece_expenses` table once confident (backup only).
- Dark-mode Stage 2 sweep (esp. Books screens that hardcode white/gray).
- Trim the `NeedsYou` "approve" signal that still points at the shelved gig flow.
- Ratings / reputation system — not built; would be the trust keystone if revisited.

---

## How to start a session

Cory pastes a fresh GitHub token. Claude clones the repo, reads `HANDOFF.md` (which
points to the newest dated handoff) for the latest session detail, then confirms in
plain English what it's about to do before doing it. Build one file at a time; SQL is
the only thing Cory pastes.
