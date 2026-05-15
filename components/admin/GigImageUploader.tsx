'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, X, Image as ImageIcon, GripVertical } from 'lucide-react'
import type { GigImageRow } from '@/types/database'

interface Props {
  gigId: string
  images: GigImageRow[]
  onImagesChange: (images: GigImageRow[]) => void
}

interface LocalImage {
  id: string
  url: string
  caption: string
  sort_order: number
  file_path?: string
  isNew?: boolean
}

export default function GigImageUploader({ gigId, images: initialImages, onImagesChange }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<LocalImage[]>(
    initialImages.map((img) => ({
      id: img.id,
      url: supabase.storage.from('gig-images').getPublicUrl(img.file_path).data.publicUrl,
      caption: img.caption,
      sort_order: img.sort_order,
      file_path: img.file_path,
    }))
  )

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

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
      if (file.size > 25 * 1024 * 1024) {
        setError('Images must be under 25MB.')
        continue
      }

      const ext = file.name.split('.').pop()
      const path = `gig-images/${gigId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('gig-images')
        .upload(path, file, { cacheControl: '3600' })

      if (uploadError) {
        setError('Upload failed. Please try again.')
        console.error('Upload error:', uploadError)
        continue
      }

      // Record in DB
      const newSortOrder = images.length
      const { data: record, error: dbError } = await supabase
        .from('gig_images')
        .insert({
          gig_id: gigId,
          file_path: path,
          caption: '',
          sort_order: newSortOrder,
        })
        .select()
        .single()

      if (dbError || !record) {
        setError('Failed to save image. Please try again.')
        console.error('DB error:', dbError)
        continue
      }

      const { data: urlData } = supabase.storage.from('gig-images').getPublicUrl(path)

      const newImage: LocalImage = {
        id: record.id,
        url: urlData.publicUrl,
        caption: '',
        sort_order: newSortOrder,
        file_path: path,
        isNew: true,
      }

      setImages((prev) => [...prev, newImage])
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function updateCaption(imageId: string, caption: string) {
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, caption } : img))
    )
    await supabase
      .from('gig_images')
      .update({ caption })
      .eq('id', imageId)
  }

  async function deleteImage(imageId: string, filePath?: string) {
    if (filePath) {
      await supabase.storage.from('gig-images').remove([filePath])
    }
    await supabase.from('gig_images').delete().eq('id', imageId)
    setImages((prev) => prev.filter((img) => img.id !== imageId))
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      return
    }

    const newImages = [...images]
    const [dragged] = newImages.splice(draggedIndex, 1)
    newImages.splice(targetIndex, 0, dragged)

    // Update sort_order for all
    const updated = newImages.map((img, idx) => ({ ...img, sort_order: idx }))
    setImages(updated)

    // Persist sort orders to DB
    for (const img of updated) {
      await supabase
        .from('gig_images')
        .update({ sort_order: img.sort_order })
        .eq('id', img.id)
    }

    setDraggedIndex(null)
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="font-sans font-semibold text-foreground">Reference Images</h2>
        <span className="text-sm font-mono text-muted-foreground">{images.length} uploaded</span>
      </div>

      <div className="card-body space-y-4">
        {/* Image grid */}
        {images.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Drag to reorder</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`group relative space-y-1 cursor-move opacity-transition ${
                    draggedIndex === index ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <div className="relative aspect-square rounded-md overflow-hidden bg-muted border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.caption || 'Reference image'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        className="p-1.5 bg-black/70 rounded text-white hover:bg-black transition-colors"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteImage(image.id, image.file_path)}
                        className="p-1.5 bg-destructive/70 rounded text-white hover:bg-destructive transition-colors"
                        aria-label="Delete image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="field-input text-xs py-1"
                    placeholder="Add caption..."
                    value={image.caption}
                    onChange={(e) => updateCaption(image.id, e.target.value)}
                    onBlur={(e) => updateCaption(image.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {images.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No reference images yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add before photos, inspiration, or details to help workers understand the job.</p>
          </div>
        )}

        {/* Upload button */}
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
            type="button"
            variant="outline"
            size="sm"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload reference images
          </Button>
        </>
      </div>
    </div>
  )
}
