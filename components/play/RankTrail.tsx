import Link from 'next/link'
import RankEmblem from './RankEmblem'

type Tier = { title: string; min: number }

export default function RankTrail({
  tiers,
  tierIdx,
  colors,
}: {
  tiers: Tier[]
  tierIdx: number
  total: number
  colors: { gold: string; muted: string; cream: string; green: string; panelBorder: string }
}) {
  return (
    <div className="mt-6 flex items-start justify-center gap-2 overflow-x-auto pb-1">
      {tiers.map((t, i) => {
        const state = i === tierIdx ? 'current' : i < tierIdx ? 'achieved' : 'locked'
        return (
          <Link
            key={t.title}
            href="/play/ranks"
            className="flex shrink-0 flex-col items-center gap-1 focus:outline-none"
            style={{ width: 54 }}
            aria-label={`${t.title} — see how ranks work`}
          >
            <RankEmblem
              index={i}
              size={i === tierIdx ? 42 : 34}
              state={state}
              idSuffix={`trail-${i}`}
            />
            <span
              className="text-center font-sans text-[9px] uppercase leading-tight tracking-wide"
              style={{
                color: state === 'current' ? colors.gold : colors.muted,
                fontWeight: state === 'current' ? 700 : state === 'achieved' ? 600 : 500,
                opacity: state === 'locked' ? 0.85 : 1,
              }}
            >
              {t.title}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
