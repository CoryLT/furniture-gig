'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, Users, ArrowRight, AlertCircle } from 'lucide-react'

export type FlipperGig = {
  id: string
  title: string
  status: string
  pay_amount: number
  due_date: string | null
  created_at: string
  city: string | null
  state: string | null
  location_text: string | null
}

interface Props {
  gigs: FlipperGig[]
  totalClaimsByGig: Record<string, number>
  pendingClaimsByGig: Record<string, number>
}

type FilterKey = 'all' | 'needs_review' | 'open' | 'in_progress' | 'completed'
type SortKey = 'newest' | 'oldest' | 'due_soon' | 'most_applicants'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'due_soon', label: 'Due date (soonest)' },
  { key: 'most_applicants', label: 'Most applicants' },
]

export default function FlipperGigList({
  gigs,
  totalClaimsByGig,
  pendingClaimsByGig,
}: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const visibleGigs = useMemo(() => {
    // Filter step
    let list = gigs.filter((g) => {
      switch (filter) {
        case 'all':
          return true
        case 'needs_review':
          return (pendingClaimsByGig[g.id] ?? 0) > 0
        case 'open':
          return g.status === 'open'
        case 'in_progress':
          return ['claimed', 'in_review'].includes(g.status)
        case 'completed':
          return g.status === 'completed'
        default:
          return true
      }
    })

    // Sort step
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'due_soon': {
          // Nulls go to the bottom
          const aTime = a.due_date ? new Date(a.due_date).getTime() : Infinity
          const bTime = b.due_date ? new Date(b.due_date).getTime() : Infinity
          return aTime - bTime
        }
        case 'most_applicants': {
          const aCount = totalClaimsByGig[a.id] ?? 0
          const bCount = totalClaimsByGig[b.id] ?? 0
          if (bCount !== aCount) return bCount - aCount
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        default:
          return 0
      }
    })

    // ALWAYS float gigs that need review to the top, regardless of sort.
    // Only when the user is on the 'all' or 'needs_review' filter — for the
    // other filters, the section is already scoped and ordering should stay
    // as the user selected.
    if (filter === 'all') {
      list = [...list].sort((a, b) => {
        const aPending = (pendingClaimsByGig[a.id] ?? 0) > 0 ? 1 : 0
        const bPending = (pendingClaimsByGig[b.id] ?? 0) > 0 ? 1 : 0
        return bPending - aPending
      })
    }

    return list
  }, [gigs, filter, sort, pendingClaimsByGig, totalClaimsByGig])

  return (
    <div className="space-y-4">
      {/* Filter chips + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={
                  active
                    ? 'px-3 py-1.5 rounded-full text-xs font-medium bg-foreground text-background border border-foreground'
                    : 'px-3 py-1.5 rounded-full text-xs font-medium bg-background text-muted-foreground border border-border hover:border-foreground hover:text-foreground transition-colors'
                }
              >
                {f.label}
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs rounded-md border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* List */}
      {visibleGigs.length === 0 ? (
        <div className="card card-body text-center py-12">
          <p className="text-muted-foreground">No gigs match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGigs.map((gig) => {
            const total = totalClaimsByGig[gig.id] ?? 0
            const pending = pendingClaimsByGig[gig.id] ?? 0

            return (
              <Link
                key={gig.id}
                href={`/flipper/gigs/${gig.id}`}
                className={
                  pending > 0
                    ? 'card hover:shadow-md transition-shadow group block border-accent/40 ring-1 ring-accent/20'
                    : 'card hover:shadow-md transition-shadow group block'
                }
              >
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                          {gig.title}
                        </h3>
                        <span className={gigStatusClass(gig.status)}>
                          {gigStatusLabel(gig.status)}
                        </span>
                        {pending > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">
                            <AlertCircle className="w-3 h-3" />
                            {pending} pending applicant{pending === 1 ? '' : 's'} — needs review
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {(gig.city || gig.location_text) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {gig.city && gig.state
                              ? `${gig.city}, ${gig.state}`
                              : gig.location_text}
                          </span>
                        )}
                        {gig.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Due {formatDate(gig.due_date)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {total} {total === 1 ? 'claim' : 'claims'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(gig.pay_amount)}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
