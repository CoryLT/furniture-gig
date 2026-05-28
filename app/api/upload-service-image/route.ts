// ============================================================
// POST /api/upload-service-image
// ============================================================
// Uploads a single cover image for a worker service.
// Runs image moderation, writes the file to the existing
// 'marketplace-photos' storage bucket, and saves the resulting
// path onto worker_services.image_path.
//
// Mirrors /api/upload-marketplace-photo. Differences:
//   - Ownership check: caller must be the service's worker_user_id
//     (or an admin)
//   - Stores the path on worker_services.image_path (one cover
//     image per service, not a separate photos table)
//   - Source tag for moderation_log: 'service_image'
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { moderateImage, logModerationCheck } from '@/lib/moderation'

export const maxDuration = 60

const UPLOAD_FAILED_GENERIC = 'Upload failed. Please try a different image.'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const serviceId = formData.get('serviceId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!serviceId) {
    return NextResponse.json({ error: 'Missing serviceId' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 })
  }

  // Verify the user owns this service (or is admin)
  const { data: service } = await supabase
    .from('worker_services')
    .select('id, worker_user_id, image_path')
    .eq('id', serviceId)
    .single<{ id: string; worker_user_id: string; image_path: string | null }>()

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  const isOwner = user.id === service.worker_user_id
  const isAdmin = userRow?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- Moderation gate ---
  const moderationResult = await moderateImage(file)
  if (!moderationResult.ok) {
    await logModerationCheck({
      supabase: supabase as never,
      userId: user.id,
      uploadSource: 'service_image',
      filePath: null,
      passed: false,
      blockReason: moderationResult.reason,
      rawScores: moderationResult.rawScores,
    })
    return NextResponse.json({ error: UPLOAD_FAILED_GENERIC }, { status: 400 })
  }

  // Build a unique file path inside the shared bucket:
  // marketplace-photos/services/<service-id>/<timestamp>.<ext>
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `services/${serviceId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('marketplace-photos')
    .upload(path, file, { cacheControl: '3600' })

  if (uploadError) {
    console.error('[upload-service-image] upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Remove the previous image (if any) so we don't orphan files
  const oldPath = service.image_path

  // Save the new path onto the service
  const { error: dbError } = await supabase
    .from('worker_services')
    // @ts-expect-error supabase update generics
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq('id', serviceId)

  if (dbError) {
    console.error('[upload-service-image] db error:', dbError)
    await supabase.storage.from('marketplace-photos').remove([path])
    return NextResponse.json({ error: 'Failed to save image' }, { status: 500 })
  }

  if (oldPath) {
    await supabase.storage.from('marketplace-photos').remove([oldPath])
  }

  await logModerationCheck({
    supabase: supabase as never,
    userId: user.id,
    uploadSource: 'service_image',
    filePath: path,
    passed: true,
    blockReason: null,
    rawScores: moderationResult.rawScores,
  })

  const { data: urlData } = supabase.storage
    .from('marketplace-photos')
    .getPublicUrl(path)

  return NextResponse.json({
    success: true,
    image: {
      file_path: path,
      url: urlData.publicUrl,
    },
  })
}
