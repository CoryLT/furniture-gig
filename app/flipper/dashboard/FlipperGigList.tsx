'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import {
  MapPin,
  Calendar,
  Users,
  ArrowRight,
  AlertCircle,
  MoreVertical,
  Edit,
  Archive,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react'
import ConfirmActionModal from '@/components/shared/ConfirmActionModal'
import { createClient } from '@/lib/supabase/client'

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
  thumbnailByGig?: Record<string, string>
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
  thumbnailByGig = {},
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [showArchived, setShowArchived] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<FlipperGig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlipperGig | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close the popover when clicking outside it.
  useEffect(() => {
    if (!openMenuId) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  async function handleArchive() {
    if (!archiveTarget) return
    setBusy(true)
    setActionError(null)
    const { error } = await supabase
      .from('gigs')
      .update({ status: 'archived' })
      .eq('id', archiveTarget.id)
    setBusy(false)
    if (error) {
      console.error('[flipper-list] archive error:', error)
      setActionError(error.message || 'Could not archive gig.')
      return
    }
    setArchiveTarget(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/gigs/${deleteTarget.id}/delete`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      setBusy(false)
      if (!res.ok) {
        setActionError(body?.error || 'Could not delete gig.')
        return
      }
      setDeleteTarget(null)
      router.refresh()
    } catch (e) {
      console.error('[flipper-list] delete error:', e)
      setBusy(false)
      setActionError('Could not delete gig. Try again.')
    }
  }

  // How many archived gigs the user has — we show this in the toggle label
  // so they know whether the toggle is worth flipping.
  const archivedCount = useMemo(
    () => gigs.filter((g) => g.status === 'archived').length,
    [gigs]
  )

  const visibleGigs = useMemo(() => {
    // Filter step
    let list = gigs.filter((g) => {
      // Hide archived gigs unless the user explicitly toggled them on.
      // This runs before the status-tab filter so archived stays out of
      // 'All', 'Open', etc. by default.
      if (g.status === 'archived' && !showArchived) return false

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
  }, [gigs, filter, sort, showArchived, pendingClaimsByGig, totalClaimsByGig])

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

        <div className="flex items-center gap-4">
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-border accent-accent"
              />
              Show archived ({archivedCount})
            </label>
          )}

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
            const menuOpen = openMenuId === gig.id
            const thumb = thumbnailByGig[gig.id]

            return (
              <div
                key={gig.id}
                className={
                  pending > 0
                    ? 'card hover:shadow-md transition-shadow group block border-accent/40 ring-1 ring-accent/20 relative'
                    : 'card hover:shadow-md transition-shadow group block relative'
                }
              >
                <div className="card-body">
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/flipper/gigs/${gig.id}`}
                      className="flex-1 min-w-0 flex items-start gap-3"
                    >
                      {/* Thumbnail (or placeholder) */}
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

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
                    </Link>

                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/flipper/gigs/${gig.id}`}
                        className="flex items-center gap-3 group"
                        aria-label="Open gig"
                      >
                        <span className="font-mono font-semibold text-foreground">
                          {formatCurrency(gig.pay_amount)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                      </Link>

                      {/* Three-dot actions menu */}
                      <div className="relative" ref={menuOpen ? menuRef : null}>
                        <button
                          type="button"
                          aria-label="More actions"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpenMenuId(menuOpen ? null : gig.id)
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-input bg-background hover:bg-secondary text-foreground transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpen && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md bg-card border border-border shadow-lg py-1 text-sm">
                            <Link
                              href={`/flipper/gigs/${gig.id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                              className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4 text-stone-600" />
                              Edit
                            </Link>
                            {gig.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  setActionError(null)
                                  setArchiveTarget(gig)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2"
                              >
                                <Archive className="w-4 h-4 text-stone-600" />
                                Archive
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null)
                                setActionError(null)
                                setDeleteTarget(gig)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-secondary flex items-center gap-2 text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Error toast shown below the list */}
      {actionError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm px-3 py-2">
          {actionError}
        </div>
      )}

      <ConfirmActionModal
        open={!!archiveTarget}
        title="Archive this gig?"
        description={
          archiveTarget
            ? `"${archiveTarget.title}" will be hidden from workers and from your dashboard. Claims and history are kept.`
            : ''
        }
        confirmLabel="Yes, archive"
        confirmVariant="destructive"
        loading={busy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
      />

      <ConfirmActionModal
        open={!!deleteTarget}
        title="Delete this gig permanently?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" and every claim, photo, checklist item, message, and payout record attached to it will be removed.\n\nThis cannot be undone.`
            : ''
        }
        typeToConfirm="DELETE"
        confirmLabel="Delete permanently"
        confirmVariant="destructive"
        loading={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
