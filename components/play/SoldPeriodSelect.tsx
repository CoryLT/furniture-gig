'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function SoldPeriodSelect({
  value,
  years,
  months,
}: {
  value: string
  years: string[]
  months: { key: string; label: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="playSold" className="font-sans text-xs text-muted-foreground">
        Show sold
      </label>
      <select
        id="playSold"
        value={value}
        onChange={(e) =>
          router.push(`${pathname}?sold=${encodeURIComponent(e.target.value)}`, { scroll: false })
        }
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <option value="month">This month</option>
        <option value="year">This year</option>
        <option value="all">All time</option>
        {years.length > 0 && (
          <optgroup label="By year">
            {years.map((y) => (
              <option key={y} value={'y:' + y}>
                {y}
              </option>
            ))}
          </optgroup>
        )}
        {months.length > 0 && (
          <optgroup label="By month">
            {months.map((m) => (
              <option key={m.key} value={'m:' + m.key}>
                {m.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <span className="font-sans text-xs text-muted-foreground">In-play tokens always show.</span>
    </div>
  )
}
