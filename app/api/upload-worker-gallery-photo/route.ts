import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get form data
  const formData = await request.formData()
  const file = formData.get('file') as File
  const caption = formData.get('caption') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
  }

  // Generate unique filename
  const timestamp = Date.now()
  const filename = `${user.id}/${timestamp}-${file.name}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('photo-galleries')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('[upload-worker-gallery-photo] upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('photo-galleries')
    .getPublicUrl(filename)

  // Insert DB record
  const { data: dbData, error: dbError } = await supabase
    .from('worker_photo_galleries')
    .insert({
      worker_user_id: user.id,
      file_path: filename,
      caption: caption || null,
    })
    .select()
    .single()

  if (dbError) {
    console.error('[upload-worker-gallery-photo] db error:', dbError)
    await supabase.storage.from('photo-galleries').remove([filename])
    return NextResponse.json({ error: 'Failed to save photo record' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    photo: {
      id: dbData.id,
      file_path: filename,
      publicUrl,
      caption: dbData.caption,
    },
  })
}
