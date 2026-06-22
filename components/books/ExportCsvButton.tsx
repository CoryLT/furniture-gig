'use client'

export default function ExportCsvButton({
  filename,
  headers,
  rows,
  label = 'Download CSV',
}: {
  filename: string
  headers: string[]
  rows: (string | number)[][]
  label?: string
}) {
  function esc(v: string | number): string {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  function download() {
    const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
    >
      {label}
    </button>
  )
}
