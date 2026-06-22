'use client'

import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'

// Adds or replaces a piece's photo via the same moderated upload as the
// Pipeline. Uploads immediately on pick (saved right away), independent of
// the entry form's Save button.
export default function PiecePhotoField({
  pieceId,
  initialUrl,
}: {
  pieceId: string
  initialUrl: string | null
}) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(f: File | null) {
    if (!f) return
    setErr('')
    if (!isAcceptableImageFile(f)) {
      setErr('That file type isn\u2019t supported. Try a JPG or PNG.')
      return
    }
    setUploading(true)
    let toSend = f
    try {
      toSend = await compressImageForUpload(f)
    } catch {
      /* fall back to original */
    }
    const fd = new FormData()
    fd.append('file', toSend)
    fd.append('pieceId', pieceId)
    try {
      const res = await fetch('/api/upload-piece-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (res.ok && json?.image?.url) {
        setUrl(json.image.url)
      } else {
        setErr(json?.error || 'Upload failed. Try again.')
      }
    } catch {
      setErr('Upload failed. Try again.')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="mt-3 border-t border-accent/20 pt-3">
      <span className="mb-1 block text-sm font-medium text-foreground">Photo</span>
      <div className="flex items-center gap-3">
        {url ? (
          <img
            src={url}
            alt=""
            className="h-16 w-16 rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          {uploading ? 'Uploading\u2026' : url ? 'Replace photo' : 'Add a photo'}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
