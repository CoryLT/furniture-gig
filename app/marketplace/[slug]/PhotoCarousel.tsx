'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MarketplacePhotoRow } from '@/types/database'

interface Props {
  photos: MarketplacePhotoRow[]
  title: string
}

export default function PhotoCarousel({ photos, title }: Props) {
  const supabase = createClient()
  const [index, setIndex] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="aspect-square bg-muted rounded-lg border border-border flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="w-12 h-12 mx-auto opacity-30" strokeWidth={1.5} />
          <p className="text-xs mt-2">No photos</p>
        </div>
      </div>
    )
  }

  const urls = photos.map(
    (p) =>
      supabase.storage.from('marketplace-photos').getPublicUrl(p.file_path).data
        .publicUrl
  )

  const goPrev = () =>
    setIndex((i) => (i === 0 ? photos.length - 1 : i - 1))
  const goNext = () =>
    setIndex((i) => (i === photos.length - 1 ? 0 : i + 1))

  return (
    <div className="space-y-2">
      {/* Main photo */}
      <div className="relative aspect-square bg-muted rounded-lg overflow-hidden border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[index]}
          alt={photos[index].caption || title}
          className="w-full h-full object-cover"
        />

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 flex items-center justify-center shadow-md transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 flex items-center justify-center shadow-md transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Counter */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-mono">
              {index + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails (only show if multiple) */}
      {photos.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {urls.slice(0, 10).map((url, i) => (
            <button
              key={photos[i].id}
              type="button"
              onClick={() => setIndex(i)}
              className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${
                i === index
                  ? 'border-accent ring-2 ring-accent/30'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Caption */}
      {photos[index].caption && (
        <p className="text-xs text-muted-foreground italic">
          {photos[index].caption}
        </p>
      )}
    </div>
  )
}
