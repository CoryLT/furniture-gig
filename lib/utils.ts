import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { GigStatus, ClaimStatus, PayoutStatus } from '@/types/database'

// Tailwind class merging utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Return the public base URL of the site (e.g. https://myflipwork.com),
 * with no trailing slash. Used for building shareable absolute URLs.
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL — set this in Vercel for the canonical domain
 *   2. VERCEL_URL — provided by Vercel for preview deploys (no protocol)
 *   3. Last-resort hard-coded production domain
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercelHost = process.env.VERCEL_URL
  if (vercelHost) return `https://${vercelHost}`.replace(/\/$/, '')

  return 'https://myflipwork.com'
}

// Format a number as USD currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Format an ISO date string as a readable date
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr))
}

// Convert a title string to a URL-safe slug
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Human-readable labels for gig statuses
export function gigStatusLabel(status: GigStatus): string {
  const labels: Record<GigStatus, string> = {
    draft: 'Draft',
    open: 'Open',
    claimed: 'Claimed',
    in_review: 'In Review',
    completed: 'Completed',
    archived: 'Archived',
  }
  return labels[status] ?? status
}

// Human-readable labels for claim statuses
export function claimStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    pending: 'Pending',
    active: 'Active',
    submitted_for_review: 'Submitted for Review',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  }
  return labels[status] ?? status
}

// Human-readable labels for payout statuses
export function payoutStatusLabel(status: PayoutStatus): string {
  const labels: Record<PayoutStatus, string> = {
    unpaid: 'Unpaid',
    pending: 'Pending',
    paid: 'Paid',
  }
  return labels[status] ?? status
}

// CSS class names for status badges
export function gigStatusClass(status: GigStatus): string {
  const classes: Record<GigStatus, string> = {
    draft: 'status-draft',
    open: 'status-open',
    claimed: 'status-claimed',
    in_review: 'status-in-review',
    completed: 'status-completed',
    archived: 'status-archived',
  }
  return classes[status] ?? ''
}

export function claimStatusClass(status: ClaimStatus): string {
  const classes: Record<ClaimStatus, string> = {
    pending: 'status-draft',
    active: 'status-open',
    submitted_for_review: 'status-in-review',
    approved: 'status-completed',
    rejected: 'status-archived',
    cancelled: 'status-archived',
  }
  return classes[status] ?? ''
}

export function payoutStatusClass(status: PayoutStatus): string {
  const classes: Record<PayoutStatus, string> = {
    unpaid: 'status-draft',
    pending: 'status-in-review',
    paid: 'status-completed',
  }
  return classes[status] ?? ''
}

// ============================================================
// Marketplace helpers
// ============================================================

// Format a cents amount as USD price text. Used on listing cards.
// e.g. 15000 -> "$150"  |  19999 -> "$199.99"
export function formatPriceFromCents(
  cents: number,
  mode: 'fixed' | 'free' = 'fixed'
): string {
  if (mode === 'free') return 'Free'
  const dollars = cents / 100
  // Show no decimals when it's a whole dollar amount; otherwise 2 decimals
  const hasCents = cents % 100 !== 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(dollars)
}

// Short relative time, like "2h ago", "3d ago", "Just now"
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 30) return 'Just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk}w ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.floor(day / 365)
  return `${yr}y ago`
}

// Human-readable condition label
export function conditionLabel(
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'for_parts' | null
): string {
  if (!condition) return ''
  const labels = {
    new: 'New',
    like_new: 'Like New',
    good: 'Good',
    fair: 'Fair',
    for_parts: 'For Parts',
  }
  return labels[condition]
}
