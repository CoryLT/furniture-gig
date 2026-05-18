import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { moderateImage, logModerationCheck } from '@/lib/moderation'

const UPLOAD_FAILED_GENERIC = 'Upload failed. Please try a different image.'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const gigId = formData.get('gigId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!gigId) {
    return NextResponse.json({ error: 'Missing gigId' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
  }

  // --- Moderation gate ---
  const moderationResult = await moderateImage(file)
  if (!moderationResult.ok) {
    await logModerationCheck({
      supabase: supabase as never,
      userId: user.id,
      uploadSource: 'gig_photo',
      filePath: null,
      passed: false,
      blockReason: moderationResult.reason,
      rawScores: moderationResult.rawScores,
    })
    return NextResponse.json({ error: UPLOAD_FAILED_GENERIC }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/${gigId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('gig-photos')
    .upload(path, file)

  if (uploadError) {
    console.error('[upload-gig-photo] upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Record in DB
  const { data: record, error: dbError } = await supabase
    .from('gig_photo_uploads')
    // @ts-expect-error supabase insert generics
    .insert({
      gig_id: gigId,
      worker_user_id: user.id,
      file_path: path,
      caption: '',
    })
    .select()
    .single<{ id: string }>()

  if (dbError || !record) {
    console.error('[upload-gig-photo] db error:', dbError)
    await supabase.storage.from('gig-photos').remove([path])
    return NextResponse.json({ error: 'Failed to save photo record' }, { status: 500 })
  }

  // Log the pass
  await logModerationCheck({
    supabase: supabase as never,
    userId: user.id,
    uploadSource: 'gig_photo',
    filePath: path,
    passed: true,
    blockReason: null,
    rawScores: moderationResult.rawScores,
  })

  const { data: urlData } = supabase.storage.from('gig-photos').getPublicUrl(path)

  return NextResponse.json({
    success: true,
    photo: {
      id: record.id,
      file_path: path,
      url: urlData.publicUrl,
    },
  })
}
