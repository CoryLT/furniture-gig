# Phase 5: Admin Image Uploader — Complete ✅

## What Got Built

I've completed Phase 5 of the FlipWork app — **Admin Image Uploader for Gig Reference Photos**.

The admin can now:
- Upload reference/before photos to gigs (during gig edit)
- Add captions to each image
- Drag to reorder images
- Delete images
- Workers see these reference images when viewing a gig
- Admin sees both reference images AND worker proof photos when reviewing submissions

---

## Files Created

### 1. **components/admin/GigImageUploader.tsx**
   - Client component for admin to upload/manage gig reference images
   - Features:
     - Multiple file upload (accepts image/* files up to 25MB)
     - Drag-and-drop reordering
     - Caption editing
     - Delete with confirmation
     - Visual feedback (loading states, error messages)
   - Stores images in Supabase Storage bucket: `gig-images`
   - Records metadata in `gig_images` table

### 2. **components/shared/GigReferenceImages.tsx**
   - Client component to display reference images
   - Shows images in a responsive grid (2-3 columns)
   - Clickable images link to full resolution
   - Shows captions below each image
   - Used by workers on gig detail page

### 3. **supabase/schema_gig_images.sql**
   - Database migration file (run this in Supabase SQL editor)
   - Creates:
     - `gig_images` table (id, gig_id, file_path, caption, sort_order, timestamps)
     - RLS policies for admin upload/view and worker read access
     - Storage bucket `gig-images` with corresponding RLS policies
     - Indexes for fast lookups

---

## Files Modified

### 1. **types/database.ts**
   - Added `GigImageRow` type definition
   - Updated Database schema with gig_images table
   - New convenience export: `export type GigImageRow`

### 2. **components/admin/GigForm.tsx**
   - Added import for `GigImageUploader`
   - Added `images` prop to component
   - Added image state management
   - Added `<GigImageUploader>` component to form (only shows in edit mode)
   - Displays after basic gig details, before checklist

### 3. **app/admin/gigs/[id]/edit/page.tsx**
   - Loads `gig_images` from database
   - Passes images to `GigForm`
   - Ordered by sort_order

### 4. **app/gigs/[slug]/page.tsx**
   - Loads `gig_images` for the gig
   - Added import for `GigReferenceImages` component
   - Displays reference images on worker gig detail page (between header and checklist)

### 5. **app/admin/review/[claimId]/page.tsx**
   - Loads reference images alongside worker proof photos
   - Shows reference images first, then worker proof photos
   - Admin can compare what they asked for vs. what worker delivered

---

## Database Schema (to run in Supabase)

**Table: gig_images**
```
- id (uuid, PK)
- gig_id (uuid, FK to gigs)
- file_path (text) — path in storage.gig-images
- caption (text)
- sort_order (int) — for drag-reorder
- created_at (timestamp)
- updated_at (timestamp)
```

**Storage Bucket: gig-images**
- Public: false (private bucket)
- Admin: full CRUD
- Workers: read-only access
- Max file size: Limited by Next.js/upload logic (25MB)

---

## How to Use

### For Admin (Creating/Editing Gigs):

1. Go to `/admin/gigs` → Click on a gig → **Edit**
2. Scroll down to **"Reference Images"** section
3. Click **"Upload reference images"**
4. Select images from your computer (multiple OK)
5. Add captions (optional): Click caption field under image
6. Reorder: Drag images to new positions
7. Delete: Hover, click X button
8. Save with rest of gig form

### For Workers (Viewing Gigs):

1. Go to `/gigs` → Click on a gig detail
2. See **"Reference Images"** section showing what admin wants
3. Click images to view full size
4. Read captions for context
5. Claim gig and start work

### For Admin (Reviewing Work):

1. Go to `/admin` → Click **"Review"** on submitted work
2. See **"Reference Images"** (what you asked for)
3. See **"Proof Photos"** (what worker delivered)
4. Compare side-by-side before approving/rejecting

---

## Next Steps (To Implement)

1. **Run the SQL migration** in your Supabase dashboard:
   - Copy contents of `supabase/schema_gig_images.sql`
   - Paste into SQL Editor → Run

2. **Test locally:**
   - Create/edit a gig in admin
   - Upload reference images
   - View gig as worker
   - Submit work and review as admin

3. **Phase 6 options:**
   - Payout tracking dashboard
   - PayPal record management
   - Worker earnings view
   - Polish & responsive testing

---

## Technical Notes

- **Storage Path:** `gig-images/{gigId}/{timestamp}.{ext}`
- **Public URLs:** Generated via Supabase SDK `getPublicUrl()`
- **Images are NOT deleted** from storage when gig is deleted (gig_images is cascade, but storage cleanup would need separate job)
- **Drag-to-reorder:** Uses DOM drag API, persists sort_order to DB immediately
- **Lazy loading:** Images use `loading="lazy"` for performance
- **Responsive:** Images grid: 2 columns on mobile, 3 on desktop

---

## Git Commit

**Commit:** `3a84e27`
**Message:** "Phase 5: Add admin gig image uploader"

**Status:** ✅ Ready to push to GitHub once you run `git push origin main` on your local machine.

---

## Questions?

If you hit any issues:
1. Check browser console for errors
2. Verify Supabase bucket `gig-images` exists (from SQL migration)
3. Confirm RLS policies are in place
4. Check file paths in `gig_images` table match uploaded paths in storage

You're all set! 🎉
