// ============================================================
// FlipWork — Marketplace listing validation
// ============================================================
// Server-side helpers for posting and editing marketplace listings.
//
//  - checkBlockedKeywords(title, description, supabaseClient)
//      Pulls the active blocked-keyword list from the DB and checks
//      whether any of them appear (case-insensitive substring match)
//      in the listing's title + description. Returns the first match.
//
//  - generateListingSlug(title)
//      Creates a URL-safe slug with a unique suffix so two listings
//      with the same title don't collide. Same approach as gigs.
//
//  - fuzzCoordinates(lat, lng)
//      Adds a random offset of ~0.3 - 0.7 miles to lat/lng so the
//      stored coordinates never reveal the exact address. Matches
//      the privacy promise made to sellers.
// ============================================================

import { slugify } from '@/lib/utils'

// ----------------------------------------------------------------
// Blocked keyword check
// ----------------------------------------------------------------

export interface BlockedKeywordHit {
  phrase: string
  category: string
}

/**
 * Returns the first blocked keyword that appears in the supplied
 * text (title + description), or null if none match.
 *
 * Uses a service-role or RLS-authorized Supabase client to read
 * the active list. Substring match, case-insensitive. We compare
 * lowercased text against lowercased phrases.
 *
 * IMPORTANT: this is a soft layer. Image moderation (Sightengine)
 * catches the harder cases. We expect false negatives here, which
 * is why we also offer a user-report path on every listing.
 */
export async function checkBlockedKeywords(
  title: string,
  description: string,
  // Passed as `any` because Supabase's generated generics make this
  // very painful to type and it's not worth the noise. Other files
  // in this codebase do the same.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<BlockedKeywordHit | null> {
  const haystack = `${title} ${description}`.toLowerCase()
  if (!haystack.trim()) return null

  const { data, error } = await supabase
    .from('marketplace_blocked_keywords')
    .select('phrase, category')
    .eq('active', true)

  if (error || !data) return null

  for (const row of data as { phrase: string; category: string }[]) {
    const phrase = row.phrase.toLowerCase().trim()
    if (!phrase) continue
    if (haystack.includes(phrase)) {
      return { phrase: row.phrase, category: row.category }
    }
  }

  return null
}

// ----------------------------------------------------------------
// Slug generation
// ----------------------------------------------------------------

/**
 * Build a URL-safe slug with a short unique suffix appended so two
 * listings with the same title don't collide. Mirrors what gigs do.
 *
 * Example:
 *   "Mid-century Walnut Dresser" -> "mid-century-walnut-dresser-l7x9a3"
 */
export function generateListingSlug(title: string): string {
  const base = slugify(title) || 'listing'
  const suffix = Date.now().toString(36).slice(-6)
  return `${base}-${suffix}`
}

// ----------------------------------------------------------------
// Coordinate fuzzing
// ----------------------------------------------------------------

/**
 * Apply a random offset of roughly 0.3–0.7 miles to lat/lng before
 * storing it. This prevents the DB from ever holding the precise
 * pickup address.
 *
 * 1 degree of latitude  ≈ 69 miles
 * 1 degree of longitude ≈ 69 miles * cos(latitude)
 *
 * We pick a random offset of 0.3 to 0.7 miles in a random direction.
 * Returns the fuzzed coordinates or null/null if input was missing.
 */
export function fuzzCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined
): { lat: number | null; lng: number | null } {
  if (lat == null || lng == null) return { lat: null, lng: null }
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { lat: null, lng: null }

  // Random distance between 0.3 and 0.7 miles
  const milesOffset = 0.3 + Math.random() * 0.4
  // Random bearing (radians)
  const bearing = Math.random() * 2 * Math.PI

  // Convert miles → degrees
  const latOffset = (milesOffset * Math.cos(bearing)) / 69
  const lngOffset =
    (milesOffset * Math.sin(bearing)) /
    (69 * Math.cos((lat * Math.PI) / 180))

  return {
    lat: Number((lat + latOffset).toFixed(6)),
    lng: Number((lng + lngOffset).toFixed(6)),
  }
}
