import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { moderateImage, logModerationCheck } from '@/lib/moderation'

// Vague, identical error so users can't reverse-engineer what triggered a block
const UPLOAD_FAILED_GENERIC = 'Upload failed. Please try a different image.'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // --- Moderation gate ---
  const moderationResult = await moderateImage(file)
  if (!moderationResult.ok) {
    // Log the block (no file_path since nothing was saved)
    await logModerationCheck({
      supabase: supabase as never,
      userId: user.id,
      uploadSource: 'avatar',
      filePath: null,
      passed: false,
      blockReason: moderationResult.reason,
      rawScores: moderationResult.rawScores,
    })
    // Vague message regardless of reason
    return NextResponse.json({ error: UPLOAD_FAILED_GENERIC }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const filename = `${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filename, file, { upsert: true })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Log the pass
  await logModerationCheck({
    supabase: supabase as never,
    userId: user.id,
    uploadSource: 'avatar',
    filePath: filename,
    passed: true,
    blockReason: null,
    rawScores: moderationResult.rawScores,
  })

  const { data: publicUrl } = supabase.storage
    .from('avatars')
    .getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl.publicUrl })
}
