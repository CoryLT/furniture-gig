'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import ListingCard, { type ListingCardData } from './ListingCard'
import type { MarketplaceCategoryRow } from '@/types/database'

interface Props {
  initialListings: ListingCardData[]
  categories: MarketplaceCategoryRow[]
  isLoggedIn: boolean
}

type SortKey = 'newest' | 'oldest' | 'price_low' | 'price_high'

export default function MarketplaceFeed({
  initialListings,
  categories,
  isLoggedIn,
}: Props) {
  const [search, setSearch] = useState('')
  const [categorySlug, setCategorySlug] = useState<string>('')
  const [state, setState] = useState<string>('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  // Build the unique state list from listings (for the state dropdown)
  const stateOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of initialListings) {
      if (l.location_state) set.add(l.location_state)
    }
    return Array.from(set).sort()
  }, [initialListings])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = initialListings.filter((l) => {
      if (categorySlug && l.category_slug !== categorySlug) return false
      if (state && l.location_state !== state) return false
      if (freeOnly && l.price_mode !== 'free') return false
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
  }, [initialListings, search, categorySlug, state, freeOnly, sortKey])

  return (
    <div className="space-y-5">
      {/* Filter / sort bar */}
      <div className="card card-body space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Category */}
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>

          {/* State */}
          {stateOptions.length > 0 && (
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All states</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Free only */}
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => setFreeOnly(e.target.checked)}
              className="rounded border-input"
            />
            Free items only
          </label>

          {/* Result count */}
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredSorted.length}{' '}
            {filteredSorted.length === 1 ? 'listing' : 'listings'}
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredSorted.length === 0 ? (
        <div className="card card-body text-center py-16">
          <p className="text-sm text-muted-foreground">
            No listings match these filters.
          </p>
          {!isLoggedIn && (
            <p className="text-xs text-muted-foreground mt-2">
              New here? Sign up to post your own.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredSorted.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  )
}
