# Handoff artifacts

This folder holds files referenced by HANDOFF.md that future sessions
might need to inspect locally.

## photo_upload_hang_reproducer.jpeg

The exact iPhone JPEG that Cory said reliably hangs the listing photo
upload (`/marketplace/new` → Step 2). Saved end of the session where
we added timeouts to the moderation + upload pipeline (commit `9796c9f`).

Specs:
- 4032 × 3024 pixels (~12 megapixels)
- 4.6 MB
- JPEG with EXIF orientation tag = `upper-right` (rotated iPhone photo)

See HANDOFF.md TODO #1 for the next-step branches based on what
re-testing with this file shows.
