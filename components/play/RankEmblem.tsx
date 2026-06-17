import { Sprout, Repeat, Hammer, Star, Gem, Crown, Lock } from 'lucide-react'

// One distinct medallion per rank: color shifts copper -> silver -> gold ->
// emerald -> violet -> radiant gold, each with its own symbol.
const RANKS = [
  { color: '#c2783f', Icon: Sprout }, // Rookie — copper
  { color: '#cad2da', Icon: Repeat }, // Flipper — silver
  { color: '#f6b73c', Icon: Hammer }, // Heavy Hitter — gold
  { color: '#57c98a', Icon: Star }, // Expert — emerald
  { color: '#b07bd6', Icon: Gem }, // Mogul — violet
  { color: '#ffd45e', Icon: Crown }, // Tycoon — radiant gold
]

type State = 'achieved' | 'current' | 'locked'

export default function RankEmblem({
  index,
  size = 64,
  state = 'current',
  idSuffix = '',
}: {
  index: number
  size?: number
  state?: State
  idSuffix?: string
}) {
  const safe = Math.max(0, Math.min(RANKS.length - 1, index))
  const r = RANKS[safe]
  const locked = state === 'locked'
  const color = locked ? '#6b6052' : r.color
  const Icon = r.Icon
  const gid = `rankgrad-${safe}-${state}-${idSuffix}`
  const glow = state === 'current' ? `drop-shadow(0 0 ${size * 0.2}px ${r.color}99)` : 'none'

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        filter: glow,
        opacity: locked ? 0.55 : 1,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id={gid} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="55%" stopColor="rgba(22,16,11,0.7)" />
            <stop offset="100%" stopColor="rgba(10,7,5,0.92)" />
          </radialGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="46"
          fill={`url(#${gid})`}
          stroke={color}
          strokeWidth={state === 'current' ? 4 : 3}
        />
        <circle cx="50" cy="50" r="39" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1.5" />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {locked ? (
          <Lock style={{ width: size * 0.32, height: size * 0.32, color }} />
        ) : (
          <Icon style={{ width: size * 0.4, height: size * 0.4, color }} />
        )}
      </div>
    </div>
  )
}
