'use client'

import type { GigImageRow } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Image as ImageIcon } from 'lucide-react'

interface Props {
  images: GigImageRow[]
}

export default function GigReferenceImages({ images }: Props) {
  const supabase = createClient()

  if (images.length === 0) return null

  const photosWithUrls = images.map((img) => ({
    ...img,
    url: supabase.storage.from('gig-images').getPublicUrl(img.file_path).data.publicUrl,
  }))

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-sans font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          Reference Images ({photosWithUrls.length})
        </h2>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photosWithUrls.map((image) => (
            <div key={image.id} className="space-y-1">
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square rounded-md overflow-hidden bg-muted border border-border hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.caption || 'Reference image'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </a>
              {image.caption && (
                <p className="text-xs text-muted-foreground line-clamp-2">{image.caption}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
