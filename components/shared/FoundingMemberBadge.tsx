import { Sparkle } from 'lucide-react'

interface Props {
  size?: 'sm' | 'md'
  label?: string
}

// ============================================================
// FoundingMemberBadge
// ============================================================
// A small gold/amber pill that flags an early signup. Used on
// public profiles, listing cards, gig cards, etc. Subtle —
// not loud — but distinctive enough to notice.
// ============================================================

export function FoundingMemberBadge({ size = 'sm', label = 'Founding Member' }: Props) {
  const padX = size === 'sm' ? 'px-2' : 'px-2.5'
  const padY = size === 'sm' ? 'py-0.5' : 'py-1'
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'

  return (
    <span
      className={`inline-flex items-center gap-1 ${padX} ${padY} ${text} font-medium rounded-full bg-amber-100 text-amber-900 border border-amber-300/60`}
      title="Joined FlipWork in the first 25 members"
    >
      <Sparkle className={`${iconSize} fill-amber-500 stroke-amber-700`} strokeWidth={1.5} />
      {label}
    </span>
  )
}
