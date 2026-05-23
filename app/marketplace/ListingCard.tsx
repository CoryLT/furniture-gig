'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPriceFromCents, timeAgo } from '@/lib/utils'
import type { MarketplaceListingRow } from '@/types/database'

export interface ListingCardData extends MarketplaceListingRow {
  cover_photo_path: string | null
  seller_username: string | null
  seller_display_name: string | null
}

interface Props {
  listing: ListingCardData
}

export default function ListingCard({ listing }: Props) {
  const supabase = createClient()
  const [loaded, setLoaded] = useState(false)

  const coverUrl = listing.cover_photo_path
    ? supabase.storage
        .from('marketplace-photos')
        .getPublicUrl(listing.cover_photo_path).data.publicUrl
    : null

  const isSold = listing.status === 'sold'

  return (
    <Link
      href={`/marketplace/${listing.slug}`}
      className="group block rounded-md overflow-hidden bg-card border border-border hover:border-foreground/30 hover:shadow-sm transition"
    >
      {/* Square cover photo */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {coverUrl ? (
          <>
            {/* Skeleton shimmer while loading */}
            {!loaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200 to-stone-100 animate-pulse" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={listing.title}
              onLoad={() => setLoaded(true)}
              className={`w-full h-full object-cover group-hover:scale-[1.02] transition-all duration-300 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-7 h-7 opacity-40" strokeWidth={1.5} />
          </div>
        )}

        {/* Free badge */}
        {listing.price_mode === 'free' && !isSold && (
          <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold tracking-wide">
            FREE
          </div>
        )}

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
            <div className="px-2.5 py-1 rounded-md bg-white text-stone-900 text-xs font-semibold tracking-wide">
              SOLD
            </div>
          </div>
        )}
      </div>

      {/* Body — tighter, price first */}
      <div className="p-2 sm:p-2.5">
        <div className="font-mono font-semibold text-sm sm:text-[15px] text-foreground leading-tight">
          {formatPriceFromCents(listing.price_cents, listing.price_mode)}
        </div>
        <div className="text-xs sm:text-sm text-foreground line-clamp-2 leading-snug mt-0.5">
          {listing.title}
        </div>
        <div className="flex items-center text-[11px] text-muted-foreground mt-1 gap-1">
          <span className="truncate">
            {listing.location_city || listing.location_state || '—'}
          </span>
          <span className="ml-auto shrink-0">·</span>
          <span className="shrink-0">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
