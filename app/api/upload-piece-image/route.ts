// ============================================================
// POST /api/upload-piece-image
// ============================================================
// Uploads a single photo for an inventory piece (the flip pipeline).
// Runs the same image moderation as every other upload path, writes to
// the shared 'marketplace-photos' bucket, and saves the path onto
// inventory_pieces.image_path.
//
// Mirrors /api/upload-service-image. Ownership: caller must own the piece
// (or be an admin). Moderation source tag: 'piece_image'.
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
  const pieceId = formData.get('pieceId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!pieceId) {
    return NextResponse.json({ error: 'Missing pieceId' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 })
  }

  // Verify the user owns this piece (or is admin)
  const { data: piece } = await supabase
    .from('inventory_pieces')
    .select('id, owner_user_id, image_path')
    .eq('id', pieceId)
    .single<{ id: string; owner_user_id: string; image_path: string | null }>()

  if (!piece) {
    return NextResponse.json({ error: 'Piece not found' }, { status: 404 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  const isOwner = user.id === piece.owner_user_id
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
      uploadSource: 'piece_image',
      filePath: null,
      passed: false,
      blockReason: moderationResult.reason,
      rawScores: moderationResult.rawScores,
    })
    return NextResponse.json({ error: UPLOAD_FAILED_GENERIC }, { status: 400 })
  }

  // marketplace-photos/pieces/<piece-id>/<timestamp>.<ext>
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `pieces/${pieceId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('marketplace-photos')
    .upload(path, file, { cacheControl: '3600' })

  if (uploadError) {
    console.error('[upload-piece-image] upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const oldPath = piece.image_path

  const { error: dbError } = await supabase
    .from('inventory_pieces')
    // @ts-expect-error supabase update generics
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq('id', pieceId)

  if (dbError) {
    console.error('[upload-piece-image] db error:', dbError)
    await supabase.storage.from('marketplace-photos').remove([path])
    return NextResponse.json({ error: 'Failed to save image' }, { status: 500 })
  }

  if (oldPath) {
    await supabase.storage.from('marketplace-photos').remove([oldPath])
  }

  await logModerationCheck({
    supabase: supabase as never,
    userId: user.id,
    uploadSource: 'piece_image',
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
    image: { file_path: path, url: urlData.publicUrl },
  })
}
