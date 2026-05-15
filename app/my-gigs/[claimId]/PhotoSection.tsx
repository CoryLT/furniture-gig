'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import type { GigPhotoUploadRow } from '@/types/database'

interface Props {
  gigId: string
  userId: string
  photos: GigPhotoUploadRow[]
  readOnly: boolean
}

interface LocalPhoto {
  id: string
  url: string
  caption: string
  isNew?: boolean
}

export default function PhotoSection({ gigId, userId, photos: initialPhotos, readOnly }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<LocalPhoto[]>(
    initialPhotos.map((p) => ({
      id: p.id,
      url: supabase.storage.from('gig-photos').getPublicUrl(p.file_path).data.publicUrl,
      caption: p.caption,
    }))
  )

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setError('')

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.')
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Images must be under 10MB.')
        continue
      }

      const ext = file.name.split('.').pop()
      const path = `${userId}/${gigId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('gig-photos')
        .upload(path, file)

      if (uploadError) {
        setError('Upload failed. Please try again.')
        continue
      }

      // Record in DB
      const { data: record, error: dbError } = await supabase
        .from('gig_photo_uploads')
        .insert({
          gig_id: gigId,
          worker_user_id: userId,
          file_path: path,
          caption: '',
        })
        .select()
        .single()

      if (dbError || !record) continue

      const { data: urlData } = supabase.storage.from('gig-photos').getPublicUrl(path)

      setPhotos((prev) => [
        ...prev,
        { id: record.id, url: urlData.publicUrl, caption: '', isNew: true },
      ])
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function updateCaption(photoId: string, caption: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
    )
    await supabase
      .from('gig_photo_uploads')
      .update({ caption })
      .eq('id', photoId)
  }

  async function deletePhoto(photoId: string, filePath: string) {
    await supabase.storage.from('gig-photos').remove([filePath])
    await supabase.from('gig_photo_uploads').delete().eq('id', photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="font-sans font-semibold text-foreground">Proof Photos</h2>
        <span className="text-sm font-mono text-muted-foreground">{photos.length} uploaded</span>
      </div>

      <div className="card-body space-y-4">
        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative space-y-1">
                <div className="relative aspect-square rounded-md overflow-hidden bg-muted border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Proof photo'}
                    className="w-full h-full object-cover"
                  />
                  {!readOnly && (
                    <button
                      onClick={() => deletePhoto(photo.id, '')}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {!readOnly ? (
                  <input
                    type="text"
                    className="field-input text-xs py-1"
                    placeholder="Add caption..."
                    value={photo.caption}
                    onChange={(e) => updateCaption(photo.id, e.target.value)}
                    onBlur={(e) => updateCaption(photo.id, e.target.value)}
                  />
                ) : photo.caption ? (
                  <p className="text-xs text-muted-foreground">{photo.caption}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && (
          <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Upload before/after photos to document your work.</p>
          </div>
        )}

        {/* Upload button */}
        {!readOnly && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload photos
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
