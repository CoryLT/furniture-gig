'use client'

import { useMemo, useState } from 'react'
import { Search, X, MapPin } from 'lucide-react'
import ListingCard, { type ListingCardData } from './ListingCard'

interface Props {
  initialListings: ListingCardData[]
  isLoggedIn: boolean
  viewerCity: string | null
}

type SortKey = 'newest' | 'oldest' | 'price_low' | 'price_high'

export default function MarketplaceFeed({
  initialListings,
  isLoggedIn,
  viewerCity,
}: Props) {
  const [search, setSearch] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  // Auto-filter to viewer's city by default; they can toggle it off
  const [cityFilterOn, setCityFilterOn] = useState<boolean>(!!viewerCity)

  // Case-insensitive city match. We compare on lowercase + trim.
  const viewerCityKey = (viewerCity ?? '').trim().toLowerCase()

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = initialListings.filter((l) => {
      if (freeOnly && l.price_mode !== 'free') return false
      if (cityFilterOn && viewerCityKey) {
        const listingCity = (l.location_city ?? '').trim().toLowerCase()
        if (listingCity !== viewerCityKey) return false
      }
      if (q) {
        const hay = `${l.title} ${l.description}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'newest':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        case 'oldest':
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        case 'price_low':
          return a.price_cents - b.price_cents
        case 'price_high':
          return b.price_cents - a.price_cents
      }
    })

    return out
  }, [initialListings, search, freeOnly, sortKey, cityFilterOn, viewerCityKey])

  const showCityChip = !!viewerCity

  return (
    <div className="space-y-3">
      {/* Sticky slim toolbar — no header above it */}
      <div className="sticky top-14 z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search listings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* City chip — only if viewer has a city on their profile */}
            {showCityChip && (
              <button
                type="button"
                onClick={() => setCityFilterOn((v) => !v)}
                title={
                  cityFilterOn
                    ? `Showing listings in ${viewerCity}. Click to show all.`
                    : `Click to filter to ${viewerCity} only.`
                }
                className={
                  cityFilterOn
                    ? 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium bg-foreground text-background hover:opacity-90 transition'
                    : 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium border border-input bg-card text-muted-foreground hover:text-foreground transition'
                }
              >
                <MapPin className="w-3.5 h-3.5" />
                {viewerCity}
                {cityFilterOn && <X className="w-3.5 h-3.5 -mr-1" />}
              </button>
            )}

            {/* Free only */}
            <label
              className={
                freeOnly
                  ? 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium bg-foreground text-background cursor-pointer select-none transition'
                  : 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium border border-input bg-card text-muted-foreground hover:text-foreground cursor-pointer select-none transition'
              }
            >
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                className="sr-only"
              />
              Free only
            </label>

            {/* Sort */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 px-2 rounded-md border border-input bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_low">Price ↑</option>
              <option value="price_high">Price ↓</option>
            </select>

            {/* Result count */}
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredSorted.length}{' '}
              {filteredSorted.length === 1 ? 'listing' : 'listings'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredSorted.length === 0 ? (
        <div className="card card-body text-center py-16">
          <p className="text-sm text-muted-foreground">
            No listings match these filters.
          </p>
          {cityFilterOn && viewerCity && (
            <button
              type="button"
              onClick={() => setCityFilterOn(false)}
              className="mt-3 text-xs text-accent hover:underline"
            >
              Show listings outside {viewerCity}
            </button>
          )}
          {!isLoggedIn && (
            <p className="text-xs text-muted-foreground mt-2">
              New here? Sign up to post your own.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-2.5">
          {filteredSorted.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  )
}
