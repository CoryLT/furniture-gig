'use client'

import { useState } from 'react'

// Whole-dollar money, with a real minus sign for negatives.
function money(n: number): string {
  return (n < 0 ? '\u2212$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')
}

// A tiny "gross vs net" toggle that sits under the big hero number.
// Tap it to see how gross profit (on sold pieces) turns into net after
// the general business costs that aren't tied to any piece.
export default function ProfitBreakdown({
  gross,
  overhead,
  net,
  gold,
  muted,
  panelBorder,
}: {
  gross: number
  overhead: number
  net: number
  gold: string
  muted: string
  panelBorder: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2 flex flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="font-sans text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
        style={{ color: muted }}
      >
        {open ? 'hide breakdown' : 'gross vs net'}
      </button>

      {open && (
        <div
          className="mt-2 w-full max-w-[240px] space-y-1.5 rounded-xl px-3 py-2.5 text-left font-sans text-xs"
          style={{ border: `1px solid ${panelBorder}` }}
        >
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: muted }}>Gross (on sold pieces)</span>
            <span className="font-mono">{money(gross)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={{ color: muted }}>&minus; Overhead (not on a piece)</span>
            <span className="font-mono">{money(overhead)}</span>
          </div>
          <div
            className="flex items-center justify-between gap-3 border-t pt-1.5 font-bold"
            style={{ borderColor: panelBorder }}
          >
            <span style={{ color: gold }}>= Net profit</span>
            <span className="font-mono" style={{ color: gold }}>
              {money(net)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
