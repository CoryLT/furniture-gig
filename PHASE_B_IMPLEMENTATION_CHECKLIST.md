# Phase B Implementation Checklist

## ✅ Code Generated

All files have been created and committed locally:
- [x] SQL migration file created
- [x] API routes created (upload & delete)
- [x] UI components created (PhotoGallery, PhotoUploadForm)
- [x] Profile pages updated (worker & flipper, editable & public)
- [x] TypeScript types updated
- [x] Git commit: "Phase B: Add worker and flipper photo galleries"

**Commit Hash:** Check your local repo with `git log` — should be recent

---

## 📋 Next Steps (In Order)

### 1. Push to GitHub (on your local machine)
```bash
cd "C:\Users\coryl\OneDrive\Documents\Claude\Projects\Furniture Flipping Gig Work\furniture-gig"
git push origin main
```

### 2. Run SQL Migration in Supabase Dashboard
Go to https://app.supabase.com → Your Project → SQL Editor

Copy & paste the entire contents of: `supabase/schema_photo_galleries.sql`

Click "Run" — should complete in 2-3 seconds

Expected output: ✅ Success (no errors)

### 3. Verify Storage Bucket
In Supabase Dashboard → Storage:
- [ ] Bucket `photo-galleries` exists
- [ ] It's set to PUBLIC
- [ ] You can see it in the list

**If it doesn't exist:** The SQL migration should have created it. If not, create manually:
- Click "New bucket"
- Name: `photo-galleries`
- Public: ON
- Click "Create bucket"

### 4. Test Locally
Start your dev server:
```bash
npm run dev
```

Then:
1. **Sign in as a worker**
   - Go to `/profile/worker`
   - Scroll to "Work Samples"
   - Upload a test image with a caption
   - Verify it appears in the gallery below
   - Try deleting it — should remove immediately

2. **Sign in as a flipper**
   - Go to `/profile/flipper`
   - Repeat upload/delete test

3. **Check public profiles**
   - **Worker:** Visit `/workers/{your-username}` in incognito window
     - Should see your gallery (read-only, no delete button)
   - **Flipper:** Visit `/flippers/{your-username}` in incognito window
     - Should see your gallery (read-only, no delete button)

### 5. Verify Supabase Tables
In Supabase Dashboard → Database → Tables:
- [ ] `worker_photo_galleries` table exists with columns:
  - id, worker_user_id, file_path, caption, display_order, created_at, updated_at
- [ ] `flipper_photo_galleries` table exists with same structure (but flipper_user_id instead)

### 6. Check RLS Policies
In Supabase Dashboard → Database → RLS:
- [ ] `worker_photo_galleries` has 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] `flipper_photo_galleries` has 4 policies
- [ ] Storage bucket `photo-galleries` has 3 policies

---

## 🧪 Quick Testing Checklist

| Test | Expected Result | Status |
|------|---|---|
| Upload photo as worker | Photo appears in gallery with caption | ❓ |
| Delete photo as worker | Photo removed from gallery immediately | ❓ |
| Upload photo as flipper | Photo appears in flipper gallery | ❓ |
| View worker public profile | Gallery visible, read-only | ❓ |
| View flipper public profile | Gallery visible, read-only | ❓ |
| File size validation | Error if > 5MB | ❓ |
| File type validation | Error if not image/* | ❓ |
| Empty gallery message | Shows "No photos yet" for new users | ❓ |

---

## 🐛 Troubleshooting

### Issue: "Failed to upload file" or database errors
**Fix:** Check that RLS policies are in place in Supabase. Run the SQL migration again.

### Issue: Photo uploads but doesn't appear in gallery
**Fix:** 
1. Check browser console for errors
2. Verify `photo-galleries` storage bucket exists and is PUBLIC
3. Try page refresh

### Issue: Error "Only image files are allowed"
**Fix:** This is correct behavior — user tried to upload non-image. Verify upload form shows this error message.

### Issue: Photos disappear after page refresh
**Fix:** This is a bug. Check:
1. Database query in `loadProfile()` is returning data
2. Storage URLs are being generated correctly
3. Supabase client is connected

---

## 📚 Documentation

Full documentation in: `PHASE_B_SUMMARY.md`

Includes:
- Feature overview
- How to use (for users)
- Technical notes
- Database schema
- API endpoint docs

---

## ✨ What's Ready for Next Phase

Once Phase B is working, you can move to:

**Phase C: Feedback/Ratings System**
- Workers leave feedback on flippers
- Flippers rate/review workers
- Display ratings on profiles
- Show feedback/testimonials

Or any other phase from your plan!

---

## Questions?

If anything fails or you get stuck:
1. Check the error messages in browser console (F12)
2. Verify all SQL migrations ran successfully
3. Confirm storage bucket exists and is PUBLIC
4. Try restarting dev server: `npm run dev`

You've got this! 🚀
