import { BadgeCheck } from 'lucide-react'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  /**
   * If true, render with text label like "Verified". If false, just the icon.
   * Default false — most places just need the icon next to a name.
   */
  withLabel?: boolean
}

// ============================================================
// VerifiedBadge
// ============================================================
// A small purple checkmark shown next to verified users' names.
//
// A user is "verified" when they've cleared a real-money trust
// gate on the platform — either Stripe has verified them as a
// worker (full KYC, bank, ID) OR they have successfully paid for
// at least one gig as a flipper (real card, real money moved).
//
// Check the `is_user_verified(uuid)` SQL function in
// supabase/schema_verified_users_20260526.sql for the exact
// definition.
//
// Use this anywhere a person's name appears in a trust-building
// context: public profile, applicant list, gig card poster name,
// listing seller name, chat headers, etc.
//
// Color note: purple (not blue) to differentiate FlipWork's
// verified mark from Twitter/Meta's blue checks. Hover tooltip
// still explains the meaning since the icon stands alone with
// no text label.
// ============================================================

export function VerifiedBadge({ size = 'sm', withLabel = false }: Props) {
  const iconSize =
    size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
  const textSize =
    size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'

  if (withLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} font-medium text-purple-700`}
        title="Verified — this user has cleared a real-money trust check on FlipWork"
      >
        <BadgeCheck
          className={`${iconSize} fill-purple-500 stroke-white`}
          strokeWidth={2.5}
        />
        Verified
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center align-middle shrink-0"
      title="Verified — this user has cleared a real-money trust check on FlipWork"
      aria-label="Verified user"
    >
      <BadgeCheck
        className={`${iconSize} fill-purple-500 stroke-white shrink-0`}
        strokeWidth={2.5}
      />
    </span>
  )
}
