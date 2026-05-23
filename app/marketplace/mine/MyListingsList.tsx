'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  formatPriceFromCents,
  timeAgo,
} from '@/lib/utils'
import {
  MapPin,
  Calendar,
  MoreVertical,
  Edit,
  CheckCircle2,
  EyeOff,
  Eye,
  Trash2,
  ImageIcon,
  ExternalLink,
} from 'lucide-react'

export type MyListing = {
  id: string
  slug: string
  title: string
  status: 'active' | 'sold' | 'hidden' | 'deleted'
  price_cents: number
  price_mode: 'fixed' | 'free'
  city: string
  state: string
  created_at: string
  sold_at: string | null
  cover_url: string | null
}

type FilterKey = 'all' | 'active' | 'sold' | 'hidden'
type SortKey = 'newest' | 'oldest' | 'price_high' | 'price_low'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'sold', label: 'Sold' },
  { key: 'hidden', label: 'Hidden' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'price_high', label: 'Price: high to low' },
  { key: 'price_low', label: 'Price: low to high' },
]

interface Props {
  listings: MyListing[]
}

export default function MyListingsList({ listings }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    let list = listings.filter((l) => {
      switch (filter) {
        case 'all':
          return true
        case 'active':
          return l.status === 'active'
        case 'sold':
          return l.status === 'sold'
        case 'hidden':
          return l.status === 'hidden'
      }
    })

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        case 'oldest':
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        case 'price_high':
          return b.price_cents - a.price_cents
        case 'price_low':
          return a.price_cents - b.price_cents
      }
    })

    return list
  }, [listings, filter, sort])

  // -- Action handlers --
  async function callAction(
    id: string,
    action: 'sold' | 'reactivate' | 'hide' | 'delete',
    confirmText?: string
  ) {
    if (confirmText && !confirm(confirmText)) return
    setBusyId(id)
    setOpenMenuId(null)
    const res = await fetch(`/api/marketplace/${id}/${action}`, {
      method: 'POST',
    })
    setBusyId(null)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error || 'Something went wrong. Try again.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filter chips + sort */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="card card-body text-center py-12 text-sm text-muted-foreground">
          No listings match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((l) => (
            <div
              key={l.id}
              className={`card card-body flex flex-col sm:flex-row gap-4 ${
                l.status === 'hidden' ? 'opacity-70' : ''
              }`}
            >
              {/* Cover */}
              <Link
                href={`/marketplace/${l.slug}`}
                className="relative w-full sm:w-32 aspect-square sm:aspect-square shrink-0 rounded-md overflow-hidden bg-muted block"
              >
                {l.cover_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={l.cover_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon
                      className="w-7 h-7 opacity-40"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
                {l.status === 'sold' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="px-2 py-0.5 rounded-md bg-white text-stone-900 text-xs font-semibold">
                      SOLD
                    </div>
                  </div>
                )}
                {l.status === 'hidden' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="px-2 py-0.5 rounded-md bg-white text-stone-900 text-xs font-semibold">
                      HIDDEN
                    </div>
                  </div>
                )}
              </Link>

              {/* Middle */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start gap-2">
                  <Link
                    href={`/marketplace/${l.slug}`}
                    className="font-semibold text-foreground hover:text-accent transition-colors min-w-0 flex-1"
                  >
                    {l.title}
                  </Link>
                  <Link
                    href={`/marketplace/${l.slug}`}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="View public listing"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
                <div className="font-mono text-lg text-foreground">
                  {formatPriceFromCents(l.price_cents, l.price_mode)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[l.city, l.state].filter(Boolean).join(', ') || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Posted {timeAgo(l.created_at)}
                  </span>
                  {l.status === 'sold' && l.sold_at && (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Sold {timeAgo(l.sold_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex sm:flex-col gap-2 sm:gap-1 sm:items-end relative">
                <Link
                  href={`/marketplace/${l.slug}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background hover:bg-secondary text-sm font-medium text-foreground transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenuId(openMenuId === l.id ? null : l.id)
                  }
                  disabled={busyId === l.id}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-input bg-background hover:bg-secondary text-foreground transition-colors disabled:opacity-50"
                  aria-label="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenuId === l.id && (
                  <div className="absolute right-0 top-full mt-1 z-10 w-48 rounded-md bg-card border border-border shadow-lg py-1 text-sm">
                    {l.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            callAction(l.id, 'sold', 'Mark this item as sold?')
                          }
                          className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Mark as sold
                        </button>
                        <button
                          type="button"
                          onClick={() => callAction(l.id, 'hide')}
                          className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                        >
                          <EyeOff className="w-4 h-4 text-stone-600" />
                          Hide listing
                        </button>
                      </>
                    )}
                    {l.status === 'sold' && (
                      <button
                        type="button"
                        onClick={() => callAction(l.id, 'reactivate')}
                        className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                        Mark as available again
                      </button>
                    )}
                    {l.status === 'hidden' && (
                      <button
                        type="button"
                        onClick={() => callAction(l.id, 'reactivate')}
                        className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                        Unhide listing
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        callAction(
                          l.id,
                          'delete',
                          'Delete this listing permanently? This cannot be undone.'
                        )
                      }
                      className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2 text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
