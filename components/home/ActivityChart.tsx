'use client'

/**
 * 30-day activity chart for the home dashboard.
 *
 * Hand-rolled SVG — no external chart library. Renders a stacked bar chart
 * where each day shows two values:
 *   - earned ($ received as a worker)
 *   - invested ($ paid as a flipper)
 *
 * Days with no activity still render as a thin baseline tick so the
 * "empty days" are visible (visual hook to fill them in).
 *
 * Hover any bar for a tooltip with the date + amounts.
 */

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export interface DayBucket {
  date: string          // ISO yyyy-mm-dd
  earned: number        // $ user received as a worker
  invested: number      // $ user paid as a flipper
}

export default function ActivityChart({ data }: { data: DayBucket[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  // Chart geometry (in SVG units, viewBox does the scaling)
  const W = 700
  const H = 180
  const PAD_LEFT = 40
  const PAD_RIGHT = 8
  const PAD_TOP = 12
  const PAD_BOTTOM = 28
  const innerW = W - PAD_LEFT - PAD_RIGHT
  const innerH = H - PAD_TOP - PAD_BOTTOM

  // Max value (combined per day) — at least $1 to avoid divide-by-zero
  const maxVal = Math.max(
    1,
    ...data.map((d) => d.earned + d.invested)
  )

  // Round max up to a "nice" tick for axis labels
  const niceMax = niceCeil(maxVal)

  const bandW = innerW / Math.max(1, data.length)
  const barW = Math.max(2, bandW * 0.7)
  const barGap = (bandW - barW) / 2

  // Y axis ticks (4 lines: 0, 1/3, 2/3, max)
  const ticks = [0, niceMax / 3, (niceMax * 2) / 3, niceMax]

  const yFor = (val: number) =>
    PAD_TOP + innerH - (val / niceMax) * innerH

  const hovered = hoverIdx !== null ? data[hoverIdx] : null

  // Totals for header
  const totalEarned = data.reduce((s, d) => s + d.earned, 0)
  const totalInvested = data.reduce((s, d) => s + d.invested, 0)
  const anyActivity = totalEarned + totalInvested > 0

  return (
    <div className="card card-body space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Last 30 days
          </h2>
          <p className="text-xs text-muted-foreground">
            Daily money flow across your account
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" />
            <span className="text-muted-foreground">Earned</span>
            <span className="font-mono font-medium text-foreground">
              {formatCurrency(totalEarned)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
            <span className="text-muted-foreground">Invested</span>
            <span className="font-mono font-medium text-foreground">
              {formatCurrency(totalInvested)}
            </span>
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="30-day activity chart"
        >
          {/* Gridlines + Y labels */}
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="currentColor"
                strokeOpacity={i === 0 ? 0.25 : 0.08}
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 6}
                y={yFor(tick) + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const x = PAD_LEFT + i * bandW + barGap
            const investedH = (d.invested / niceMax) * innerH
            const earnedH = (d.earned / niceMax) * innerH
            const investedY = PAD_TOP + innerH - investedH
            const earnedY = investedY - earnedH
            const isHover = hoverIdx === i
            const hasAny = d.earned + d.invested > 0

            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: hasAny ? 'pointer' : 'default' }}
              >
                {/* Invisible wide hit area for easier hover */}
                <rect
                  x={PAD_LEFT + i * bandW}
                  y={PAD_TOP}
                  width={bandW}
                  height={innerH}
                  fill="transparent"
                />
                {/* Baseline tick for empty days */}
                {!hasAny && (
                  <rect
                    x={x}
                    y={PAD_TOP + innerH - 1}
                    width={barW}
                    height={1.5}
                    fill="currentColor"
                    opacity={isHover ? 0.35 : 0.15}
                  />
                )}
                {/* Invested (blue) — bottom */}
                {d.invested > 0 && (
                  <rect
                    x={x}
                    y={investedY}
                    width={barW}
                    height={investedH}
                    fill="rgb(59 130 246)"
                    opacity={isHover ? 1 : 0.85}
                    rx={1}
                  />
                )}
                {/* Earned (accent) — on top */}
                {d.earned > 0 && (
                  <rect
                    x={x}
                    y={earnedY}
                    width={barW}
                    height={earnedH}
                    fill="hsl(150 58% 38%)"
                    opacity={isHover ? 1 : 0.9}
                    rx={1}
                  />
                )}
              </g>
            )
          })}

          {/* X axis: 4 evenly-spaced date labels */}
          {[0, 9, 19, 29].map((idx) => {
            if (!data[idx]) return null
            const x = PAD_LEFT + idx * bandW + bandW / 2
            return (
              <text
                key={idx}
                x={x}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {formatXAxisDate(data[idx].date)}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="absolute top-2 right-2 bg-card border border-border rounded-md shadow-sm px-3 py-2 text-xs space-y-0.5 pointer-events-none"
            style={{ minWidth: '160px' }}
          >
            <div className="font-medium text-foreground">
              {formatTooltipDate(hovered.date)}
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Earned</span>
              <span className="font-mono text-foreground">
                {formatCurrency(hovered.earned)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Invested</span>
              <span className="font-mono text-foreground">
                {formatCurrency(hovered.invested)}
              </span>
            </div>
          </div>
        )}
      </div>

      {!anyActivity && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          No money has moved through your account in the last 30 days. Post or claim a gig to get started.
        </p>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// helpers
// ----------------------------------------------------------------

/** Round a number up to a nice ceiling (10, 25, 50, 100, 250, ...). */
function niceCeil(n: number): number {
  if (n <= 10) return 10
  const exp = Math.floor(Math.log10(n))
  const base = Math.pow(10, exp)
  const m = n / base
  if (m <= 1) return 1 * base
  if (m <= 2) return 2 * base
  if (m <= 2.5) return 2.5 * base
  if (m <= 5) return 5 * base
  return 10 * base
}

function formatAxis(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

function formatXAxisDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatTooltipDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
