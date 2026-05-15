'use client'

import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, Wrench, ArrowRight, Image as ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { GigRow } from '@/types/database'

interface Props {
  gig: GigRow
  isClaimed: boolean
}

export default function GigListingCard({ gig, isClaimed }: Props) {
  const supabase = createClient()
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadThumbnail() {
      try {
        const { data: images } = await supabase
          .from('gig_images')
          .select('*')
          .eq('gig_id', gig.id)
          .order('sort_order')
          .limit(1)

        if (images?.[0]) {
          const url = supabase.storage.from('gig-images').getPublicUrl(images[0].file_path).data.publicUrl
          setThumbnailUrl(url)
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err)
      } finally {
        setLoading(false)
      }
    }

    loadThumbnail()
  }, [gig.id, supabase])

  return (
    <Link
      href={`/gigs/${gig.slug}`}
      className="card hover:shadow-md transition-shadow group block overflow-hidden"
    >
      {/* Thumbnail image */}
      {thumbnailUrl && (
        <div className="w-full h-40 bg-muted overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={gig.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      )}

      {!thumbnailUrl && !loading && (
        <div className="w-full h-40 bg-muted flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      <div className="card-body space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-sans font-semibold text-base text-foreground group-hover:text-accent transition-colors leading-snug">
              {gig.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono capitalize">
              {gig.furniture_type}
            </p>
          </div>
          <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
        </div>

        {/* Summary */}
        {gig.summary && (
          <p className="text-sm text-muted-foreground line-clamp-2">{gig.summary}</p>
        )}

        {/* Meta */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {(gig.city || gig.location_text) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {gig.city && gig.state ? `${gig.city}, ${gig.state}` : gig.location_text}
            </div>
          )}
          {gig.due_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              Due {formatDate(gig.due_date)}
            </div>
          )}
          {gig.required_skills.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              {gig.required_skills.join(', ')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="font-mono font-semibold text-foreground">
            {formatCurrency(gig.pay_amount)}
          </span>
          <span className="text-xs text-accent flex items-center gap-1 group-hover:gap-1.5 transition-all">
            {isClaimed ? 'View your claim' : 'View gig'}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
