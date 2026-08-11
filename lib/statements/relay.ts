// ---------------------------------------------------------------------------
// Relay bank-statement reader.
//
// Relay exports a clean CSV, one row per transaction, with these columns:
//   Date, Payee, Account #, Transaction Type, Description, Reference,
//   Status, Amount, Currency, Balance
//
// This file turns that CSV into a plain list of transactions in ONE shared
// shape (NormalizedTxn) that the rest of the importer understands. The Wells
// Fargo reader (built next) produces the exact same shape, so the auto-sorter
// after it never has to care which bank a line came from.
//
// Money sign rule for the whole importer: amount is POSITIVE for money in and
// NEGATIVE for money out. Relay already signs its Amount column that way
// ("+416.76", "-203.42"), so we keep it as-is.
//
// This is pure string-in / objects-out. No database, no network — so it is
// safe to run and easy to test on a real file.
// ---------------------------------------------------------------------------

export type NormalizedTxn = {
  postedDate: string | null // 'YYYY-MM-DD' when we can read it, else null
  amount: number // signed: + money in, − money out
  rawDescription: string // human-readable summary of the line
  payee: string | null // clean merchant / counterparty when the bank gives one
  externalId: string // stable key so the same line can't import twice
  source: string // which bank this came from — here always 'relay'
}

// Split one CSV line into fields, respecting "quoted, commas" and "" escapes.
// (Relay's Reference field has commas inside quotes, so a plain split(',')
// would break it.)
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"' // an escaped double-quote inside a quoted field
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(field)
      field = ''
    } else {
      field += c
    }
  }
  out.push(field)
  return out
}

// "3/29/2026" -> "2026-03-29". Returns null if it doesn't look like a date.
function toIsoDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let [, mm, dd, yy] = m
  if (yy.length === 2) yy = '20' + yy
  const mo = mm.padStart(2, '0')
  const da = dd.padStart(2, '0')
  return `${yy}-${mo}-${da}`
}

// Turn text into a short, safe token for building the dedup key.
function slug(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Clean up messy spacing / stray non-printable bytes for display.
function tidy(s: string): string {
  return (s || '').replace(/\s+/g, ' ').replace(/[^\x20-\x7E]+/g, '').trim()
}

// Money like "-203.42", "+416.76", "1,234.56" -> a signed number (or NaN).
function toAmount(raw: string): number {
  const cleaned = (raw || '').replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '+' || cleaned === '-') return NaN
  return Number(cleaned)
}

// Find a column's index by header name (case-insensitive, trims spaces).
// Header-driven so a future column reorder doesn't silently break us.
function headerIndex(headers: string[], name: string): number {
  const want = name.trim().toLowerCase()
  return headers.findIndex((h) => h.trim().toLowerCase() === want)
}

export function parseRelayCsv(csvText: string): NormalizedTxn[] {
  if (!csvText) return []
  // Normalize newlines, drop a UTF-8 BOM if present, split into lines.
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  if (lines.length < 2) return [] // header only (or empty) -> nothing to read

  const headers = splitCsvLine(lines[0])
  const iDate = headerIndex(headers, 'Date')
  const iPayee = headerIndex(headers, 'Payee')
  const iType = headerIndex(headers, 'Transaction Type')
  const iRef = headerIndex(headers, 'Reference')
  const iStatus = headerIndex(headers, 'Status')
  const iAmount = headerIndex(headers, 'Amount')
  const iBalance = headerIndex(headers, 'Balance')

  const out: NormalizedTxn[] = []

  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r])
    const cell = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')

    const amount = toAmount(cell(iAmount))
    if (!Number.isFinite(amount)) continue // no readable amount -> skip

    // Skip anything not settled (pending lines can change / double up later).
    const status = tidy(cell(iStatus)).toLowerCase()
    if (status && status !== 'settled') continue

    const postedDate = toIsoDate(cell(iDate))
    const payee = tidy(cell(iPayee)) || null
    const reference = tidy(cell(iRef))
    const balance = tidy(cell(iBalance))

    // A readable one-line summary: "Lowe's — Corporate Card - 3117 (Business Card)"
    const rawDescription =
      [payee, reference].filter(Boolean).join(' — ') || tidy(cell(iType)) || 'Transaction'

    // Relay gives no transaction id, so build a stable key from the fields that
    // together make a line unique: date + amount + payee + running balance.
    const externalId = [
      'relay',
      postedDate ?? 'nodate',
      amount.toFixed(2),
      slug(payee ?? ''),
      slug(balance),
    ].join(':')

    out.push({ postedDate, amount, rawDescription, payee, externalId, source: 'relay' })
  }

  return out
}
