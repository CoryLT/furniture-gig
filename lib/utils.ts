import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { GigStatus, ClaimStatus, PayoutStatus } from '@/types/database'

// Tailwind class merging utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
