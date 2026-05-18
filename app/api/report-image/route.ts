import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const VALID_KINDS = [
  'avatar',
  'flipper_gallery',
  'worker_gallery',
  'gig_photo',
  'gig_image',
] as const

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    imageKind?: string
    filePath?: string
    bucket?: string
    sourceRowId?: string
    ownerUserId?: string
    reason?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageKind, filePath, bucket, sourceRowId, ownerUserId, reason } = body

  if (!imageKind || !VALID_KINDS.includes(imageKind as never)) {
    return NextResponse.json({ error: 'Invalid imageKind' }, { status: 400 })
  }
  if (!filePath || !bucket) {
    return NextResponse.json({ error: 'Missing filePath or bucket' }, { status: 400 })
  }
  if (!reason || reason.length > 1000) {
    return NextResponse.json({ error: 'Reason required (max 1000 chars)' }, { status: 400 })
  }

  const { error } = await supabase
    .from('image_reports')
    // @ts-expect-error supabase insert generics
    .insert({
      reporter_user_id: user.id,
      image_kind: imageKind,
      file_path: filePath,
      bucket,
      source_row_id: sourceRowId ?? null,
      owner_user_id: ownerUserId ?? null,
      reason,
    })

  if (error) {
    console.error('[report-image] insert error:', error)
    return NextResponse.json({ error: 'Could not file report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
