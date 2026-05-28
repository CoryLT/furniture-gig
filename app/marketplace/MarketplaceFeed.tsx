'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, MapPin } from 'lucide-react'
import ListingCard, { type ListingCardData } from './ListingCard'
import ServiceCard, { type ServiceCardData } from './ServiceCard'

interface Props {
  initialListings: ListingCardData[]
  initialServices: ServiceCardData[]
  isLoggedIn: boolean
  viewerCity: string | null
}

type SortKey = 'newest' | 'oldest' | 'price_low' | 'price_high'
type Mode = 'items' | 'services'

export default function MarketplaceFeed({
  initialListings,
  initialServices,
  isLoggedIn,
  viewerCity,
}: Props) {
  const [mode, setMode] = useState<Mode>('items')
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

  // Services: filter by search (category + blurb) and by provider city.
  // No free/price filters — services price differently.
  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return initialServices.filter((s) => {
      if (cityFilterOn && viewerCityKey) {
        const providerCity = (s.provider_city ?? '').trim().toLowerCase()
        if (providerCity !== viewerCityKey) return false
      }
      if (q) {
        const hay = `${s.categoryLabel} ${s.blurb}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [initialServices, search, cityFilterOn, viewerCityKey])

  const showCityChip = !!viewerCity

  return (
    <div className="space-y-3">
      {/* Mode toggle: Items vs Services */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode('items')}
          className={
            mode === 'items'
              ? 'px-4 py-1.5 rounded-md font-medium bg-foreground text-background transition'
              : 'px-4 py-1.5 rounded-md font-medium text-muted-foreground hover:text-foreground transition'
          }
        >
          Items
        </button>
        <button
          type="button"
          onClick={() => setMode('services')}
          className={
            mode === 'services'
              ? 'px-4 py-1.5 rounded-md font-medium bg-foreground text-background transition'
              : 'px-4 py-1.5 rounded-md font-medium text-muted-foreground hover:text-foreground transition'
          }
        >
          Services
        </button>
      </div>

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
              </button>
            )}

            {/* Free only — items only */}
            {mode === 'items' && (
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
            )}

            {/* Sort — items only */}
            {mode === 'items' && (
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
            )}

            {/* Result count */}
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {mode === 'items' ? (
                <>
                  {filteredSorted.length}{' '}
                  {filteredSorted.length === 1 ? 'listing' : 'listings'}
                </>
              ) : (
                <>
                  {filteredServices.length}{' '}
                  {filteredServices.length === 1 ? 'service' : 'services'}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {mode === 'items' && (
        filteredSorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card text-center py-16 px-4">
          {initialListings.length === 0 ? (
            <>
              <p className="text-sm text-foreground font-medium">
                FlipWork just launched.
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                The marketplace is still filling in. Be one of the first to
                list a piece — early sellers get more eyes on their work.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {isLoggedIn ? (
                  <Link
                    href="/marketplace/new"
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition"
                  >
                    Post a listing
                  </Link>
                ) : (
                  <Link
                    href="/auth/signup"
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition"
                  >
                    Sign up to post
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground font-medium">
                No matches for your filters.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {cityFilterOn && viewerCity
                  ? `Nothing in ${viewerCity} fits — try clearing the city filter.`
                  : 'Try clearing your filters to see everything.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {cityFilterOn && viewerCity && (
                  <button
                    type="button"
                    onClick={() => setCityFilterOn(false)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-input bg-card hover:bg-secondary transition"
                  >
                    Show all locations
                  </button>
                )}
                {(search || freeOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setFreeOnly(false)
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-input bg-card hover:bg-secondary transition"
                  >
                    Clear filters
                  </button>
                )}
                {isLoggedIn && (
                  <Link
                    href="/marketplace/new"
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition"
                  >
                    Post a listing
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-2.5">
          {filteredSorted.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
        )
      )}

      {/* Services grid */}
      {mode === 'services' && (
        filteredServices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card text-center py-16 px-4">
            {initialServices.length === 0 ? (
              <>
                <p className="text-sm text-foreground font-medium">
                  No services listed yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Members can list the work they do for hire — like repairs,
                  refinishing, or delivery. Be one of the first.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {isLoggedIn ? (
                    <Link
                      href="/profile/worker/services"
                      className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition"
                    >
                      List a service
                    </Link>
                  ) : (
                    <Link
                      href="/auth/signup"
                      className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition"
                    >
                      Sign up to offer services
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground font-medium">
                  No services match your filters.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cityFilterOn && viewerCity
                    ? `Nothing in ${viewerCity} fits — try clearing the city filter.`
                    : 'Try clearing your search to see everything.'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {cityFilterOn && viewerCity && (
                    <button
                      type="button"
                      onClick={() => setCityFilterOn(false)}
                      className="text-xs font-medium px-3 py-1.5 rounded-md border border-input bg-card hover:bg-secondary transition"
                    >
                      Show all locations
                    </button>
                  )}
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-xs font-medium px-3 py-1.5 rounded-md border border-input bg-card hover:bg-secondary transition"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-2.5">
            {filteredServices.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
