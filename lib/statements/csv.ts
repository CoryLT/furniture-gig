// ---------------------------------------------------------------------------
// Bank-CSV reader (auto-detecting).
//
// Different banks export very different CSV columns. Relay gives
//   Date, Payee, Account #, Transaction Type, Description, Reference, Status,
//   Amount, Currency, Balance
// while Wells Fargo gives just
//   DATE, DESCRIPTION, AMOUNT, CHECK #, STATUS
//
// parseAnyBankCsv() peeks at the header row and routes to the right reader, so
// the upload button works no matter which bank the file came from. Both paths
// produce the same NormalizedTxn shape (positive = money in, negative = out).
// ---------------------------------------------------------------------------

import { parseRelayCsv, type NormalizedTxn } from './relay'

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      out.push(field)
      field = ''
    } else field += c
  }
  out.push(field)
  return out
}

// Accepts MM/DD/YYYY, M/D/YY, or YYYY-MM-DD.
function toIsoDate(raw: string): string | null {
  const s = (raw || '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    let yy = m[3]
    if (yy.length === 2) yy = '20' + yy
    return `${yy}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

function tidy(s: string): string {
  return (s || '').replace(/\s+/g, ' ').replace(/[^\x20-\x7E]+/g, '').trim()
}
function slug(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}
function toAmount(raw: string): number {
  const cleaned = (raw || '').replace(/[$,\s"]/g, '')
  if (cleaned === '' || cleaned === '+' || cleaned === '-') return NaN
  return Number(cleaned)
}
// Small stable hash so two same-day, same-amount rows (e.g. two Circle K stops)
// get distinct dedup keys. Bank descriptions carry a unique ref, so hashing the
// full text keeps distinct transactions distinct while staying stable on re-download.
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}
function headerIndex(headers: string[], names: string[]): number {
  for (const name of names) {
    const i = headers.findIndex((h) => h.trim().toLowerCase() === name)
    if (i >= 0) return i
  }
  return -1
}

// Generic single-signed-amount CSV (Wells Fargo and most banks): one Amount
// column where minus = money out, plus = money in.
function parseGenericCsv(csvText: string, source: string): NormalizedTxn[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0])
  const iDate = headerIndex(headers, ['date', 'posting date', 'transaction date'])
  const iDesc = headerIndex(headers, ['description', 'payee', 'memo', 'name'])
  const iAmount = headerIndex(headers, ['amount'])
  const iStatus = headerIndex(headers, ['status'])
  if (iDate < 0 || iAmount < 0) return [] // not a shape we understand

  const out: NormalizedTxn[] = []
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r])
    const cell = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')

    const amount = toAmount(cell(iAmount))
    if (!Number.isFinite(amount) || amount === 0) continue

    const status = tidy(cell(iStatus)).toLowerCase()
    if (status && !['posted', 'settled', 'cleared', 'complete', 'completed'].includes(status)) continue

    const postedDate = toIsoDate(cell(iDate))
    const rawDescription = tidy(cell(iDesc)) || 'Transaction'
    const externalId = [source, postedDate ?? 'nodate', amount.toFixed(2), hash(rawDescription)].join(':')
    out.push({ postedDate, amount, rawDescription, payee: null, externalId, source })
  }
  return out
}

// Peek at the header, pick the right reader.
export function parseAnyBankCsv(csvText: string): NormalizedTxn[] {
  if (!csvText) return []
  const firstLine = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).find((l) => l.trim() !== '') || ''
  const headers = splitCsvLine(firstLine).map((h) => h.trim().toLowerCase())

  const looksRelay = headers.includes('payee') && headers.includes('transaction type')
  if (looksRelay) return parseRelayCsv(csvText)

  // Everything else: generic signed-amount reader (Wells Fargo, etc.).
  return parseGenericCsv(csvText, 'wellsfargo')
}
