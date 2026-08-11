// ---------------------------------------------------------------------------
// Wells Fargo statement reader.
//
// Wells Fargo only gives a PDF, and its transaction rows are messy: a long
// description with the store name buried in the middle, and TWO money columns
// (Deposits/Credits and Withdrawals/Debits) instead of one signed amount.
//
// So we hand the PDF to the AI reader (the same Anthropic client the receipt
// scanner uses) and ask for a clean JSON list of rows. Then a small, pure
// normalizer turns those rows into the shared NormalizedTxn shape — positive
// for money in, negative for money out — with a stable dedup key.
//
// The normalizer (aiRowsToNormalized) is plain logic and is unit-tested. The
// AI call (readStatementPdf) takes the Anthropic client as an argument so it
// stays easy to reason about and swap.
// ---------------------------------------------------------------------------

import type { NormalizedTxn } from './relay'

// One row as the AI is asked to return it.
export type AiRow = {
  date?: string | null
  description?: string | null
  amount?: number | string | null
}

function slug(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function tidy(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim()
}

// "2026-05-13", "5/13/2026", "05/13" -> "YYYY-MM-DD" (guessing year if absent).
function toIsoDate(raw: string | null | undefined, fallbackYear: number): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    let yy = m[3]
    if (yy.length === 2) yy = '20' + yy
    return `${yy}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/) // no year on the row -> use the statement's
  if (m) return `${fallbackYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

// "1,234.56", "-58.92", "$490.00" -> a number (or NaN).
function toAmount(raw: number | string | null | undefined): number {
  if (typeof raw === 'number') return raw
  if (raw == null) return NaN
  const cleaned = String(raw).replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '+' || cleaned === '-') return NaN
  return Number(cleaned)
}

// Turn the AI's rows into clean NormalizedTxn objects. Pure + tested.
export function aiRowsToNormalized(
  rows: AiRow[],
  source: string,
  fallbackYear: number = new Date().getFullYear()
): NormalizedTxn[] {
  if (!Array.isArray(rows)) return []
  const out: NormalizedTxn[] = []
  for (const row of rows) {
    const amount = toAmount(row?.amount)
    if (!Number.isFinite(amount) || amount === 0) continue // no real amount -> skip
    const rawDescription = tidy(String(row?.description ?? '')) || 'Transaction'
    const postedDate = toIsoDate(row?.date, fallbackYear)
    const externalId = [
      source,
      postedDate ?? 'nodate',
      amount.toFixed(2),
      slug(rawDescription),
    ].join(':')
    out.push({ postedDate, amount, rawDescription, payee: null, externalId, source })
  }
  return out
}

// The prompt we give the AI. Kept explicit so the JSON comes back clean.
const PROMPT =
  'This is a bank statement PDF. Read the transaction history and return ONLY a ' +
  'JSON array (no prose, no markdown) of every individual transaction, one object ' +
  'per row, like: [{"date":"YYYY-MM-DD","description":string,"amount":number}]. ' +
  'RULES: (1) amount is POSITIVE for money coming in (deposits/credits) and ' +
  'NEGATIVE for money going out (withdrawals/debits). (2) Use the year shown on the ' +
  'statement for every date. (3) description = the full transaction description on ' +
  'that row, joined into one line. (4) Skip summary lines, running "ending daily ' +
  'balance" figures, totals, fees tables, and any non-transaction text. Only real ' +
  'posted transactions. Return [] if you find none.'

// Read a statement PDF with the AI and return normalized transactions.
// `anthropic` is the shared client; `model` is the model id to use.
export async function readStatementPdf(
  anthropic: any,
  model: string,
  base64Pdf: string,
  source: string,
  fallbackYear: number = new Date().getFullYear()
): Promise<NormalizedTxn[]> {
  const resp = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  const text = (resp.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim()
  const clean = text.replace(/```json|```/g, '').trim()

  let rows: AiRow[] = []
  try {
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed)) rows = parsed
    else if (Array.isArray(parsed?.transactions)) rows = parsed.transactions
  } catch {
    rows = []
  }
  return aiRowsToNormalized(rows, source, fallbackYear)
}
