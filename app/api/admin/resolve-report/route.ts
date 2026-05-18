import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Map an image_kind to the DB table that owns the row, so removing
// an image also removes the DB record. avatar is special — it lives
// on the worker/flipper profile (avatar_url), not in its own table.
const KIND_TO_TABLE: Record<string, string | null> = {
  avatar: null, // no per-row table; image lives only in storage + profile column
  flipper_gallery: 'flipper_photo_galleries',
  worker_gallery: 'worker_photo_galleries',
  gig_photo: 'gig_photo_uploads',
  gig_image: 'gig_images',
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Must be admin
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()
  if (userRow?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    reportId?: string
    action?: 'remove' | 'keep' | 'dismiss'
    bucket?: string
    filePath?: string
    imageKind?: string
    adminNotes?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reportId, action, bucket, filePath, imageKind, adminNotes } = body

  if (!reportId || !action || !['remove', 'keep', 'dismiss'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (!bucket || !filePath || !imageKind) {
    return NextResponse.json({ error: 'Missing image details' }, { status: 400 })
  }

  // If removing, delete from storage AND the corresponding DB row
  if (action === 'remove') {
    // Delete from storage
    const { error: storageErr } = await supabase.storage.from(bucket).remove([filePath])
    if (storageErr) {
      console.error('[resolve-report] storage remove failed:', storageErr)
      // Don't fail the whole action — the DB row removal still matters
    }

    // Delete the DB row (if there is one)
    const table = KIND_TO_TABLE[imageKind]
    if (table) {
      const { error: dbErr } = await supabase.from(table).delete().eq('file_path', filePath)
      if (dbErr) {
        console.error('[resolve-report] db row delete failed:', dbErr)
      }
    } else if (imageKind === 'avatar') {
      // Clear avatar_url from whichever profile table references it
      await supabase
        .from('worker_profiles')
        // @ts-expect-error supabase update generics
        .update({ avatar_url: null })
        .like('avatar_url', `%${filePath}%`)
      await supabase
        .from('flipper_profiles')
        // @ts-expect-error supabase update generics
        .update({ avatar_url: null })
        .like('avatar_url', `%${filePath}%`)
    }
  }

  // Update the report row
  const newStatus =
    action === 'remove'
      ? 'resolved_removed'
      : action === 'keep'
        ? 'resolved_kept'
        : 'dismissed'

  const { error: updateErr } = await supabase
    .from('image_reports')
    // @ts-expect-error supabase update generics
    .update({
      status: newStatus,
      admin_notes: adminNotes ?? null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', reportId)

  if (updateErr) {
    console.error('[resolve-report] update error:', updateErr)
    return NextResponse.json({ error: 'Could not update report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, newStatus })
}
