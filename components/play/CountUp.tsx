'use client'

import { useEffect, useRef, useState } from 'react'

// Animates a dollar amount from 0 up to `value` when it first appears,
// so opening the screen feels like the number is climbing.
export default function CountUp({
  value,
  duration = 900,
}: {
  value: number
  duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDisplay(value)
      return
    }
    let raf = 0
    startRef.current = null
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const p = Math.min(1, (t - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic — fast then settles
      setDisplay(value * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else setDisplay(value)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  const neg = display < 0
  const formatted = Math.abs(display).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return (
    <span>
      {neg ? '\u2212' : ''}${formatted}
    </span>
  )
}
