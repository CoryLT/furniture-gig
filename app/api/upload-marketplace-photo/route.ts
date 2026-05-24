// ============================================================
// POST /api/upload-marketplace-photo
// ============================================================
// Uploads a single image attached to a marketplace listing.
// Runs Sightengine moderation, writes the file to storage, and
// inserts a row in marketplace_photos.
//
// Mirrors /api/upload-gig-image. Differences:
//   - Storage bucket: 'marketplace-photos'
//   - Ownership check: caller must be the listing's seller_user_id
//     (or an admin)
//   - Source tag for moderation_log: 'marketplace_photo'
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { moderateImage, logModerationCheck } from '@/lib/moderation'

// Tell Vercel this route is allowed up to 60 seconds. Default on Hobby
// plan is 10s which is shorter than our 30s moderation timeout — without
// this the function gets killed mid-call and the client hangs.
export const maxDuration = 60

const UPLOAD_FAILED_GENERIC = 'Upload failed. Please try a different image.'

export async function POST(request: NextRequest) {
  const t0 = Date.now()
  const log = (msg: string) =>
    console.log(`[upload-marketplace-photo] +${Date.now() - t0}ms ${msg}`)

  log('route entry')
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    log('no user → 401')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  log(`auth ok user=${user.id}`)

  const formData = await request.formData()
  log('formData parsed')
  const file = formData.get('file') as File
  const listingId = formData.get('listingId') as string | null
  const sortOrderRaw = formData.get('sortOrder') as string | null
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listingId' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 })
  }
  log(`file ok name=${file.name} size=${file.size} type=${file.type}`)

  // Verify the user owns this listing (or is admin)
  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, seller_user_id')
    .eq('id', listingId)
    .single<{ id: string; seller_user_id: string }>()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  const isOwner = user.id === listing.seller_user_id
  const isAdmin = userRow?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  log('ownership ok')

  // --- Moderation gate ---
  log('moderation start')
  const moderationResult = await moderateImage(file)
  log(`moderation done ok=${moderationResult.ok}`)
  if (!moderationResult.ok) {
    await logModerationCheck({
      supabase: supabase as never,
      userId: user.id,
      uploadSource: 'marketplace_photo',
      filePath: null,
      passed: false,
      blockReason: moderationResult.reason,
      rawScores: moderationResult.rawScores,
    })
    return NextResponse.json({ error: UPLOAD_FAILED_GENERIC }, { status: 400 })
  }

  // Build a unique file path: marketplace-photos/<listing-id>/<timestamp>.<ext>
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${listingId}/${Date.now()}.${ext}`

  log('storage upload start')
  const { error: uploadError } = await supabase.storage
    .from('marketplace-photos')
    .upload(path, file, { cacheControl: '3600' })
  log(`storage upload done err=${uploadError ? uploadError.message : 'none'}`)

  if (uploadError) {
    console.error('[upload-marketplace-photo] upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Insert DB row
  log('db insert start')
  const { data: record, error: dbError } = await supabase
    .from('marketplace_photos')
    // @ts-expect-error supabase insert generics
    .insert({
      listing_id: listingId,
      file_path: path,
      caption: '',
      sort_order: sortOrder,
    })
    .select()
    .single<{ id: string }>()
  log(`db insert done err=${dbError ? dbError.message : 'none'}`)

  if (dbError || !record) {
    console.error('[upload-marketplace-photo] db error:', dbError)
    await supabase.storage.from('marketplace-photos').remove([path])
    return NextResponse.json({ error: 'Failed to save image record' }, { status: 500 })
  }

  // Log the pass
  await logModerationCheck({
    supabase: supabase as never,
    userId: user.id,
    uploadSource: 'marketplace_photo',
    filePath: path,
    passed: true,
    blockReason: null,
    rawScores: moderationResult.rawScores,
  })

  const { data: urlData } = supabase.storage
    .from('marketplace-photos')
    .getPublicUrl(path)

  log('returning success')
  return NextResponse.json({
    success: true,
    image: {
      id: record.id,
      file_path: path,
      url: urlData.publicUrl,
      sort_order: sortOrder,
    },
  })
}
