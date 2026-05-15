# Phase 5: Visual Guide — Admin Image Uploader

## 🎯 User Flows

---

## Admin: Uploading Reference Images

### Step 1: Edit a Gig
```
/admin/gigs → [Click gig] → "Edit" button
```

### Step 2: Scroll to Reference Images Section
```
┌─────────────────────────────────────────────────────┐
│  📎 Gig Details                                     │
│  [Title, Type, Status, Pay, Location, Due Date]   │
├─────────────────────────────────────────────────────┤
│  📷 REFERENCE IMAGES                        0 ✓     │
│                                                      │
│  No reference images yet.                           │
│  Add before photos, inspiration, or details to     │
│  help workers understand the job.                   │
│                                                      │
│  [📤 Upload reference images]                       │
├─────────────────────────────────────────────────────┤
│  ✓ Checklist                                        │
│  [Existing checklist items...]                      │
└─────────────────────────────────────────────────────┘
```

### Step 3: Upload Images
```
Click [📤 Upload reference images] → File picker opens

Select multiple images (.jpg, .png, etc.)
Max 25MB per image

Upload progress:
  🔄 Uploading...
```

### Step 4: View & Reorder Images
```
┌─────────────────────────────────────────────────────┐
│  📷 REFERENCE IMAGES                        3 ✓     │
│  Drag to reorder                                    │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │          │  │          │  │          │         │
│  │  Before  │  │ Detail   │  │ Close-up │         │
│  │  (image) │  │ (image)  │  │ (image)  │         │
│  │          │  │          │  │          │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│  Add caption...  Add caption...  Add caption...     │
│                                                     │
│  [Drag handles + delete buttons appear on hover]   │
│                                                     │
│  [📤 Upload reference images]                       │
└─────────────────────────────────────────────────────┘
```

### Step 5: Add Captions
```
Click caption field below image:
  "Add caption..." → "Before refinishing - heavy damage"
  
These captions appear to workers when they view the gig
```

### Step 6: Reorder by Dragging
```
Hover over image → See grip icon (⋮⋮)
Click & drag → Move to new position
Release → Automatically saves sort order

Order: [1. Before] [2. Details] [3. Close-up]
```

### Step 7: Delete if Needed
```
Hover over image → See delete button (✕)
Click X → Image deleted from storage & DB
```

### Step 8: Save Gig
```
Scroll down → [Save changes] button
✅ Gig saved with all reference images
```

---

## Worker: Viewing Reference Images

### Step 1: Browse Gigs
```
/gigs → [Click on a gig detail page]
```

### Step 2: See Reference Images
```
┌─────────────────────────────────────────────────────┐
│  [← Back to gigs]                                   │
│                                                      │
│  ✓ Draft | table  $150                             │
│  Refinish oak dining table                          │
│                                                      │
│  📍 Nashville, TN  📅 Due May 30, 2025             │
│  🔧 sanding, staining, polyurethane                │
│                                                      │
│  Full description of what you need to do...        │
│                                                      │
├─────────────────────────────────────────────────────┤
│  🖼️  REFERENCE IMAGES (3)                          │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ [image]  │  │ [image]  │  │ [image]  │         │
│  │          │  │          │  │          │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│  Before       Detail        Close-up on          │
│  refinishing  of damage      leg damage           │
│                                                     │
│  [Click any image to view full size]               │
├─────────────────────────────────────────────────────┤
│  ✓ Checklist (4 items)                             │
│  ○ Sand all surfaces smooth                        │
│  ○ Stain with dark walnut                         │
│  ○ Apply 3 coats of polyurethane                  │
│  ○ Inspect for defects                            │
│                                                     │
│  [Claim this gig]                                  │
└─────────────────────────────────────────────────────┘
```

---

## Admin: Reviewing Submissions

### Step 1: Go to Admin Dashboard
```
/admin → See "Pending Reviews" section
```

### Step 2: View Submission
```
Click [Review] on a submitted gig
```

### Step 3: Compare Reference vs. Proof Photos
```
┌─────────────────────────────────────────────────────┐
│  Refinish oak dining table                          │
│  Submitted for review                               │
│  Worker: John Smith (john@paypal.com)              │
│  Payout: $150                                       │
├─────────────────────────────────────────────────────┤
│  ✓ Checklist                                       │
│  ✓ Sand all surfaces smooth (notes: used 180 grit) │
│  ✓ Stain with dark walnut                          │
│  ✓ Apply 3 coats of polyurethane                   │
│  ✓ Inspect for defects                             │
├─────────────────────────────────────────────────────┤
│  🖼️  REFERENCE IMAGES (3)                          │
│  [What you asked for]                              │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Before   │  │ Detail   │  │ Close-up │         │
│  │ (admin   │  │ (admin   │  │ (admin   │         │
│  │  image)  │  │  image)  │  │  image)  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
├─────────────────────────────────────────────────────┤
│  📸 PROOF PHOTOS (4)                               │
│  [What worker delivered]                           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ After    │  │ Detail   │  │ Top view │         │
│  │ (worker  │  │ (worker  │  │ (worker  │         │
│  │  photo)  │  │  photo)  │  │  photo)  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                 [More photos...]                    │
│                                                     │
│  After photo shows: Clear finish on table top     │
└─────────────────────────────────────────────────────┘
```

### Step 4: Compare & Decide
```
✅ APPROVE: Worker delivered what was asked
❌ REJECT: Quality doesn't match reference images
```

---

## Data Flow Diagram

```
ADMIN UPLOADS IMAGES
    ↓
Storage: supabase/gig-images/{gigId}/{timestamp}.jpg
Database: gig_images table (file_path, caption, sort_order)
    ↓
WORKERS SEE ON GIG DETAIL
    ↓
GigReferenceImages component displays:
  - Images grid (2-3 columns)
  - Captions
  - Click-to-view-fullsize links
    ↓
WORKER CLAIMS & UPLOADS PROOF PHOTOS
    ↓
Storage: supabase/gig-photos/{userId}/{gigId}/{timestamp}.jpg
Database: gig_photo_uploads table
    ↓
ADMIN REVIEWS BOTH
    ↓
Admin review page shows:
  - Reference images (top)
  - Worker proof photos (bottom)
  - Side-by-side comparison
    ↓
ADMIN APPROVES/REJECTS
    ↓
Payout created or claim status updated
```

---

## File Sizes & Limits

| Aspect | Limit | Notes |
|---|---|---|
| Image file size | 25 MB | Per image |
| Images per gig | Unlimited | Practical: ~10-20 |
| Supported formats | .jpg, .png, .webp, .gif | Any image/* mime type |
| Storage bucket | `gig-images` | Private (needs auth) |

---

## User Experience Highlights

✨ **Admin Experience:**
- Fast drag-to-reorder
- Real-time caption editing
- Easy delete with hover interface
- Visual confirmation (upload progress)

✨ **Worker Experience:**
- Clear reference images before claiming
- Full-size image view on click
- Context from captions
- Understands expectations

✨ **Admin Review:**
- Compare what they asked vs. what worker delivered
- Justify approvals/rejections with visual evidence
- Organized side-by-side view

---

## Responsive Design

**Desktop (1024px+):**
- 3 columns of images
- Comfortable spacing

**Tablet (768px):**
- 2-3 columns (responsive)
- Touch-friendly drag handles

**Mobile (< 768px):**
- 2 columns of images
- Thumb-friendly buttons
- Smooth scrolling

---

Done! Visual guide complete. 🎨
