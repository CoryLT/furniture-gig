'use client'

import { useEffect, useState } from 'react'

// A glowing progress bar that fills from empty to `pct` when it appears —
// the XP-bar moment. Respects reduced-motion.
export default function GameBar({ pct }: { pct: number }) {
  const [w, setW] = useState(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setW(pct)
      return
    }
    const t = setTimeout(() => setW(pct), 140)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        background: 'var(--play-bar-track)',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${w}%`,
          borderRadius: 999,
          background: 'linear-gradient(90deg, #f59e0b 0%, #fde68a 100%)',
          boxShadow: '0 0 12px rgba(245,158,11,0.65)',
          transition: 'width 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}
