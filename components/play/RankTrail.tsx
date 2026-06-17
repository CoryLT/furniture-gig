'use client'

import { useEffect, useRef, useState } from 'react'
import RankEmblem from './RankEmblem'

type Tier = { title: string; min: number }
const fmt = (v: number) => '$' + Math.round(Math.abs(v)).toLocaleString('en-US')

export default function RankTrail({
  tiers,
  tierIdx,
  total,
  colors,
}: {
  tiers: Tier[]
  tierIdx: number
  total: number
  colors: { gold: string; muted: string; cream: string; green: string; panelBorder: string }
}) {
  const [active, setActive] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Tap-away to close on touch.
  useEffect(() => {
    if (active === null) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [active])

  return (
    <div ref={ref} className="mt-6 flex items-start justify-center gap-2 overflow-x-auto pb-1">
      {tiers.map((t, i) => {
        const state = i === tierIdx ? 'current' : i < tierIdx ? 'achieved' : 'locked'
        const req = i === 0 ? 'The starting line' : `Reach ${fmt(t.min)} profit`
        const status =
          i < tierIdx ? 'Earned \u2713' : i === tierIdx ? "You're here" : `${fmt(t.min - total)} to go`
        const statusColor = i < tierIdx ? colors.green : i === tierIdx ? colors.cream : colors.gold
        const open = active === i
        return (
          <div
            key={t.title}
            className="relative flex shrink-0 flex-col items-center gap-1"
            style={{ width: 54 }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActive((cur) => (cur === i ? null : i))
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') setActive(i)
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') setActive((cur) => (cur === i ? null : cur))
              }}
              className="flex flex-col items-center gap-1 focus:outline-none"
              aria-label={`${t.title}: ${req}`}
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
            </button>

            {open ? (
              <div
                role="tooltip"
                className="absolute bottom-full left-1/2 z-20 mb-2 w-40 -translate-x-1/2 rounded-xl px-3 py-2 text-center"
                style={{
                  background: 'var(--play-tooltip-bg)',
                  border: '1px solid var(--play-tooltip-border)',
                  boxShadow: 'var(--play-tooltip-shadow)',
                }}
              >
                <div
                  className="font-sans text-xs font-bold uppercase tracking-wide"
                  style={{ color: colors.gold }}
                >
                  {t.title}
                </div>
                <div className="mt-0.5 font-sans text-[11px]" style={{ color: colors.muted }}>
                  {req}
                </div>
                <div className="mt-1 font-mono text-[11px] font-bold" style={{ color: statusColor }}>
                  {status}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
