'use client'

import { useRouter } from 'next/navigation'

export default function YearPicker({ year, years }: { year: number; years: number[] }) {
  const router = useRouter()
  return (
    <select
      value={year}
      onChange={(e) => router.push('/books/tax?year=' + e.target.value)}
      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )
}
