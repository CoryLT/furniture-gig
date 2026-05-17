# Phase B: Worker & Flipper Photo Galleries — Complete ✅

## What Got Built

Phase B adds **photo galleries** to both worker and flipper profiles. Users can now upload work samples to showcase their skills and completed projects.

### Features:
- Workers & flippers upload photos to their **editable profiles**
- Add captions to each photo (optional)
- Delete photos they've uploaded
- Public read-only galleries on public profiles
- Responsive image grid (3 columns on desktop, 1-2 on mobile)
- File validation (image only, max 5MB)
- Success/error messaging

---

## Files Created

### 1. **supabase/schema_photo_galleries.sql**
   - Database migration file (run in Supabase SQL editor)
   - Creates:
     - `worker_photo_galleries` table
     - `flipper_photo_galleries` table
     - Storage bucket `photo-galleries` (PUBLIC)
     - RLS policies for public read, authenticated upload, and user delete

### 2. **API Routes**
   - `app/api/upload-worker-gallery-photo/route.ts` — Upload photos to worker gallery
   - `app/api/upload-flipper-gallery-photo/route.ts` — Upload photos to flipper gallery
   - `app/api/delete-gallery-photo/route.ts` — Delete photos (works for both user types)

### 3. **UI Components**
   - `components/ui/PhotoGallery.tsx` — Reusable gallery display component
   - `components/ui/PhotoUploadForm.tsx` — Photo upload form with preview
   - `components/worker/PublicWorkerProfileClient.tsx` — Public worker profile with gallery
   - `components/flipper/PublicFlipperProfileClient.tsx` — Public flipper profile with gallery

---

## Files Modified

### 1. **types/database.ts**
   - Added `worker_photo_galleries` table definition
   - Added `flipper_photo_galleries` table definition
   - Added convenience exports:
     - `WorkerPhotoGalleryRow`
     - `FlipperPhotoGalleryRow`

### 2. **app/profile/worker/page.tsx**
   - Added imports for `PhotoUploadForm` and `PhotoGallery`
   - Added `photos` state
   - Updated `loadProfile()` to fetch user's gallery photos
   - Added `handlePhotoDeleted()` handler
   - Added `handlePhotoUploaded()` handler
   - Added gallery section to editable worker profile

### 3. **app/profile/flipper/page.tsx**
   - Added imports for `PhotoUploadForm` and `PhotoGallery`
   - Added `photos` state
   - Updated `loadProfile()` to fetch user's gallery photos
   - Added `handlePhotoDeleted()` handler
   - Added `handlePhotoUploaded()` handler
   - Added gallery section to editable flipper profile

### 4. **app/workers/[username]/page.tsx**
   - Converted to server component that loads photos
   - Now passes photos to `PublicWorkerProfileClient` component

### 5. **app/flippers/[username]/page.tsx**
   - Converted to server component that loads photos
   - Now passes photos to `PublicFlipperProfileClient` component

---

## Database Schema

### Table: worker_photo_galleries
```sql
id (uuid, PK)
worker_user_id (uuid, FK to users)
file_path (text) — path in storage.photo-galleries
caption (text, nullable)
display_order (int) — for future drag-reorder
created_at (timestamp)
updated_at (timestamp)
```

### Table: flipper_photo_galleries
```sql
id (uuid, PK)
flipper_user_id (uuid, FK to users)
file_path (text) — path in storage.photo-galleries
caption (text, nullable)
display_order (int) — for future drag-reorder
created_at (timestamp)
updated_at (timestamp)
```

### Storage Bucket: photo-galleries
- Public: true (images are publicly viewable)
- Max file size: 5MB (enforced by client, API validates)
- Path structure: `{userId}/{timestamp}-{filename}`

---

## How to Use

### For Users (Uploading):

1. Go to `/profile/worker` or `/profile/flipper` (editable profile)
2. Scroll to **"Work Samples"** section
3. Click **"Upload Photo"**
4. Select an image (PNG, JPG, WebP)
5. Add caption (optional)
6. Click "Upload Photo"
7. Photos appear in gallery below form
8. Delete anytime by clicking the Delete button on a photo

### For Visitors (Viewing):

1. Visit a worker at `/workers/{username}`
2. Or visit a flipper at `/flippers/{username}`
3. See **"Work Samples"** section with read-only gallery
4. Click images to view full size (uses Next.js Image optimization)

---

## Setup Instructions

1. **Run the SQL migration** in your Supabase dashboard:
   - Copy contents of `supabase/schema_photo_galleries.sql`
   - Paste into SQL Editor → Run

2. **Create the storage bucket** (if not auto-created):
   - Go to Supabase Storage
   - Create new bucket: `photo-galleries`
   - Set to PUBLIC
   - RLS policies are created by SQL migration

3. **Test locally:**
   - Go to `/profile/worker` or `/profile/flipper`
   - Upload a photo with a caption
   - Verify it appears in the gallery
   - Try deleting it
   - Visit your public profile and see the gallery there too

4. **Test as visitor:**
   - Visit `/workers/{your-username}` in incognito/private window
   - Verify you see the gallery (read-only, no delete button)

---

## Technical Notes

- **Storage Path:** `photo-galleries/{userId}/{timestamp}-{filename}`
- **Public URLs:** Generated via Supabase SDK `getPublicUrl()`
- **Image Optimization:** Uses Next.js `<Image>` component with responsive `sizes`
- **Lazy Loading:** Images use `loading="lazy"` for performance
- **Responsive Grid:** 1 column mobile, 2 columns tablet, 3 columns desktop
- **File Validation:** Client-side (filetype, size) + server-side (filetype, size)
- **Ownership:** RLS policies ensure users can only delete their own photos
- **Error Handling:** Storage cleanup on DB insert failure; user-friendly error messages

---

## Next Steps (Phase C)

**Phase C: Feedback/Ratings System**
- Workers leave feedback on flippers
- Flippers rate/review workers
- Display ratings on profiles
- Feedback history/testimonials

---

## Git Commit

**Status:** Ready to commit and push

```bash
git add .
git commit -m "Phase B: Add worker and flipper photo galleries"
git push origin main
```

---

## Deployment

No changes needed to Vercel config — everything deploys as-is. Just push to GitHub and Vercel auto-deploys.

---

Done! 🎉
