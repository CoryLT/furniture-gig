'use client'

import { Download } from 'lucide-react'

type Row = {
  worker: string
  username: string
  date: string
  gig: string
  method: string
  amount: number
}

// Wrap a value so commas, quotes, and newlines don't break the CSV.
function csvCell(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ExportButton({
  year,
  rows,
}: {
  year: number
  rows: Row[]
}) {
  function download() {
    const header = ['Worker', 'Username', 'Date Paid', 'Job', 'Method', 'Amount']
    const lines = [header.map(csvCell).join(',')]
    for (const r of rows) {
      lines.push(
        [r.worker, r.username, r.date, r.gig, r.method, r.amount.toFixed(2)]
          .map(csvCell)
          .join(',')
      )
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flipwork-payments-${year}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  )
}
