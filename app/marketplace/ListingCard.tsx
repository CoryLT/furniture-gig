'use client'

import Link from 'next/link'
import { MapPin, ImageIcon } from 'lucide-react'
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

  const coverUrl = listing.cover_photo_path
    ? supabase.storage
        .from('marketplace-photos')
        .getPublicUrl(listing.cover_photo_path).data.publicUrl
    : null

  const isSold = listing.status === 'sold'

  return (
    <Link
      href={`/marketplace/${listing.slug}`}
      className="group block rounded-lg overflow-hidden bg-card border border-border hover:shadow-md transition-shadow"
    >
      {/* Square cover photo */}
      <div className="relative aspect-square bg-muted">
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-8 h-8 opacity-40" strokeWidth={1.5} />
          </div>
        )}

        {/* Free badge */}
        {listing.price_mode === 'free' && !isSold && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-semibold">
            FREE
          </div>
        )}

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="px-3 py-1 rounded-md bg-white text-stone-900 text-sm font-semibold">
              SOLD
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1">
        <div className="font-mono font-semibold text-foreground">
          {formatPriceFromCents(listing.price_cents, listing.price_mode)}
        </div>
        <div className="text-sm text-foreground line-clamp-2 leading-snug min-h-[2.5em]">
          {listing.title}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {listing.location_city
              ? `${listing.location_city}${listing.location_state ? ', ' + listing.location_state : ''}`
              : listing.location_state || '—'}
          </span>
          <span className="ml-auto shrink-0">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
