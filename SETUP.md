# FlipWork — Setup Guide

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Vercel](https://vercel.com) account for deployment

---

## 1. Clone & install

```bash
cd "Furniture Flipping Gig Work"
npm install
```

---

## 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the entire contents of `supabase/schema.sql` and run it
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (keep this secret)

---

## 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_ADMIN_EMAIL=your-admin-email@example.com
```

> **Important:** `NEXT_PUBLIC_ADMIN_EMAIL` should be the email you'll use to sign up as admin.

---

## 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 5. Create your admin account

1. Go to `/auth/signup` and sign up with the email you set in `NEXT_PUBLIC_ADMIN_EMAIL`
2. The `handle_new_user` trigger will automatically assign the `admin` role if your email matches
3. If it doesn't work automatically, go to Supabase → Table Editor → `users` table and manually set `role = 'admin'` for your user row

---

## 6. Deploy to Vercel

1. Push your project to GitHub
2. Import the repo in Vercel
3. Add all four environment variables in **Vercel → Project → Settings → Environment Variables**
4. Deploy

---

## Key routes

| Route | Description |
|---|---|
| `/` | Public landing page |
| `/auth/signup` | Worker signup |
| `/auth/login` | Login |
| `/gigs` | Browse open gigs (workers) |
| `/my-gigs` | Worker's claimed gigs |
| `/my-gigs/payouts` | Worker's payout history |
| `/admin` | Admin dashboard |
| `/admin/gigs` | Manage all gigs |
| `/admin/gigs/new` | Create a new gig |
| `/admin/payouts` | Manage PayPal payouts |

---

## Storage

The schema creates a `gig-photos` Supabase Storage bucket automatically. Workers upload photos there when completing gigs. Make sure your Supabase project has Storage enabled (it is by default).

---

## Customizing the agreement

Go to Supabase → Table Editor → `legal_agreements`. Edit the `content` field to replace the placeholder text with your actual independent contractor agreement before going live.
