'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { UserRowVM } from './page'

interface Props {
  rows: UserRowVM[]
}

// Client-side searchable table. Server sent us the full list
// already, so filtering is just a substring match on email.
// We keep the table simple: a header row, a body, and a
// "no matches" state. If Cory later wants column sorting or
// filters (Pro only, active only) we can add them here.
export default function UsersTable({ rows }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.email.toLowerCase().includes(q))
  }, [query, rows])

  return (
    <div className="card">
      <div className="card-body">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email"
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No accounts match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <Th>Email</Th>
                  <Th>Joined</Th>
                  <Th>Plan</Th>
                  <Th className="text-right">Pieces</Th>
                  <Th className="text-right">Sold</Th>
                  <Th>Last active</Th>
                  <Th>Role</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/40"
                  >
                    <Td>
                      <span className="font-medium text-foreground break-all">
                        {r.email}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatShortDate(r.joinedAt)}
                    </Td>
                    <Td>
                      <PlanBadge badge={r.proBadge} />
                    </Td>
                    <Td className="text-right tabular-nums text-foreground">
                      {r.totalPieces}
                    </Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {r.soldPieces}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {r.lastActive ? relativeAgo(r.lastActive) : '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {r.role === 'admin' ? (
                        <span className="text-amber-700 font-medium">
                          admin
                        </span>
                      ) : (
                        r.role || 'user'
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Showing {filtered.length} of {rows.length}
          {query && ` (filtered by "${query}")`}
        </p>
      </div>
    </div>
  )
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <th className={`py-2 pr-4 font-medium ${className ?? ''}`}>{children}</th>
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`py-2.5 pr-4 align-middle ${className ?? ''}`}>{children}</td>
}

function PlanBadge({ badge }: { badge: UserRowVM['proBadge'] }) {
  if (!badge) {
    return <span className="text-xs text-muted-foreground">Free</span>
  }
  const styles: Record<NonNullable<UserRowVM['proBadge']>, string> = {
    Paying: 'bg-green-50 text-green-800 border-green-200',
    Trial: 'bg-blue-50 text-blue-800 border-blue-200',
    Founding: 'bg-amber-50 text-amber-800 border-amber-200',
  }
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${styles[badge]}`}
    >
      {badge}
    </span>
  )
}

// Short date like "Jul 18" for compact columns.
function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// "3d ago" style relative time — same style as the dashboard's activity
// feed so the two pages feel consistent.
function relativeAgo(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return formatShortDate(iso)
}
