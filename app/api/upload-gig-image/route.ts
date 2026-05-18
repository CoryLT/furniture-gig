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
  const sortOrderRaw = formData.get('sortOrder') as string | null
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!gigId) {
    return NextResponse.json({ error: 'Missing gigId' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 25MB' }, { status: 400 })
  }

  // Verify the user is the gig poster (or an admin)
  const { data: gig } = await supabase
    .from('gigs')
    .select('id, poster_user_id, created_by')
    .eq('id', gigId)
    .single<{ id: string; poster_user_id: string | null; created_by: string | null }>()

  if (!gig) {
    return NextResponse.json({ error: 'Gig not found' }, { status: 404 })
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  const isPoster = user.id === gig.poster_user_id || user.id === gig.created_by
  const isAdmin = userRow?.role === 'admin'

  if (!isPoster && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- Moderation gate ---
  const moderationResult = await moderateImage(file)
  if (!moderationResult.ok) {
    await logModerationCheck({
      supabase: supabase as never,
      userId: user.id,
      uploadSource: 'gig_image',
      filePath: null,
      passed: false,
      blockReason: moderationResult.reason,
      rawScores: moderationResult.rawScores,
    })
    return NextResponse.json({ error: UPLOAD_FAILED_GENERIC }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const path = `gig-images/${gigId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('gig-images')
    .upload(path, file, { cacheControl: '3600' })

  if (uploadError) {
    console.error('[upload-gig-image] upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Record in DB
  const { data: record, error: dbError } = await supabase
    .from('gig_images')
    // @ts-expect-error supabase insert generics
    .insert({
      gig_id: gigId,
      file_path: path,
      caption: '',
      sort_order: sortOrder,
    })
    .select()
    .single<{ id: string }>()

  if (dbError || !record) {
    console.error('[upload-gig-image] db error:', dbError)
    await supabase.storage.from('gig-images').remove([path])
    return NextResponse.json({ error: 'Failed to save image record' }, { status: 500 })
  }

  // Log the pass
  await logModerationCheck({
    supabase: supabase as never,
    userId: user.id,
    uploadSource: 'gig_image',
    filePath: path,
    passed: true,
    blockReason: null,
    rawScores: moderationResult.rawScores,
  })

  const { data: urlData } = supabase.storage.from('gig-images').getPublicUrl(path)

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
