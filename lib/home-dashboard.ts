/**
 * Helpers for the home dashboard data crunching.
 */

import type { DayBucket } from '@/components/home/ActivityChart'

/**
 * Returns an array of N consecutive day-strings (yyyy-mm-dd), ending today.
 * For N=30, this gives the last 30 days in chronological order.
 */
export function lastNDays(n: number): string[] {
  const out: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    out.push(toISODate(d))
  }
  return out
}

/** Convert a Date to yyyy-mm-dd in the LOCAL timezone (not UTC). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Get yyyy-mm-dd portion of a timestamp string, treating it as local time. */
export function isoDayOf(ts: string): string {
  return toISODate(new Date(ts))
}

/**
 * Build 30 empty day buckets and overlay an array of {date, earned, invested}
 * deltas. Days the user had no activity stay at $0.
 */
export function buildBuckets(
  days: string[],
  records: { date: string; earned?: number; invested?: number }[]
): DayBucket[] {
  const map = new Map<string, DayBucket>()
  for (const d of days) {
    map.set(d, { date: d, earned: 0, invested: 0 })
  }
  for (const r of records) {
    const b = map.get(r.date)
    if (!b) continue // outside the window
    b.earned += r.earned ?? 0
    b.invested += r.invested ?? 0
  }
  return days.map((d) => map.get(d)!)
}
