# Phase 5 Setup Checklist

## ✅ Code Complete
- [x] GigImageUploader component created
- [x] GigReferenceImages display component created
- [x] GigForm updated to include image uploader
- [x] Admin edit page updated
- [x] Worker gig detail page updated
- [x] Admin review page updated
- [x] Database types updated
- [x] Git commit ready

## 🔧 To Do (On Your Machine)

### 1. Push to GitHub
```bash
cd "C:\Users\coryl\OneDrive\Documents\Claude\Projects\Furniture Flipping Gig Work"
# OR if you're in the C:\Dev\furniture-gig folder:
cd C:\Dev\furniture-gig
git push origin main
```

### 2. Run Database Migration (in Supabase)
- Go to https://supabase.com
- Open your FlipWork project
- Click **SQL Editor** → **New Query**
- Copy contents of `supabase/schema_gig_images.sql`
- Paste and click **Run**
- Wait for success confirmation

### 3. Test Locally
1. Start dev server: `npm run dev`
2. Log in as admin
3. Go to `/admin/gigs`
4. Click on a gig → **Edit**
5. Scroll to **Reference Images** section
6. Upload 2-3 test images
7. Add captions, try dragging to reorder
8. Click **Save changes**
9. Log out → Log in as worker
10. Go to `/gigs`
11. View the gig you just edited
12. Verify reference images show up

### 4. Verify Admin Review Page
1. As worker: Claim the gig
2. Upload some proof photos
3. Submit for review
4. As admin: Go to `/admin`
5. Click **Review** on the submission
6. Verify you see:
   - Reference Images (your images)
   - Proof Photos (worker's images)

---

## 📁 Key File Locations

| File | Purpose |
|---|---|
| `components/admin/GigImageUploader.tsx` | Admin upload component |
| `components/shared/GigReferenceImages.tsx` | Worker view component |
| `app/admin/gigs/[id]/edit/page.tsx` | Admin edit page |
| `app/gigs/[slug]/page.tsx` | Worker gig detail |
| `app/admin/review/[claimId]/page.tsx` | Admin review page |
| `supabase/schema_gig_images.sql` | Database migration |
| `types/database.ts` | TypeScript types |
| `components/admin/GigForm.tsx` | Updated form |

---

## 🚀 Deployment

When you're ready to deploy to Vercel:
1. Make sure SQL migration is run in production Supabase
2. Push code to GitHub
3. Vercel auto-deploys from main branch

---

## 📊 What Changed (Summary)

**New Tables:** 1 (`gig_images`)
**New Storage Buckets:** 1 (`gig-images`)
**New Components:** 2 (GigImageUploader, GigReferenceImages)
**Modified Components:** 1 (GigForm)
**Modified Pages:** 3 (admin edit, gig detail, admin review)
**Lines Added:** ~500 lines of code
**Files Changed:** 8 files

---

Done! Let me know when you've pushed to GitHub and run the SQL migration. 🎉
