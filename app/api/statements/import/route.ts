import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, SUPPORT_MODEL } from '@/lib/anthropic'
import { getPlan, isPro, isAdminEmail } from '@/lib/plan'
import { type NormalizedTxn } from '@/lib/statements/relay'
import { parseAnyBankCsv } from '@/lib/statements/csv'
import { readStatementPdf } from '@/lib/statements/wellsfargo'
import { sortTxn, ACCOUNTS, type SortResult } from '@/lib/statements/sort'

// POST /api/statements/import
// Body: FormData with one or more "file" entries (Relay .csv or Wells Fargo .pdf).
//
// Flow: read each file -> normalized lines -> save into books_bank_feed (the
// same holding pen the reconcile screen uses, with its built-in "can't import
// twice" guard) -> auto-sort each line by Cory's rules -> post the confident
// ones straight into the ledger. Unsure lines are left in the feed for a quick
// look on the reconcile screen. No approval gate — clean lines just land.
export const dynamic = 'force-dynamic'

type Summary = {
  ok: boolean
  imported: number // new lines added to the feed this run
  autoPosted: number // lines written straight into the books
  alreadyCounted: number // sale/ATM cash moves (money relocated, not re-booked)
  needLook: number // left for a quick look on the reconcile screen
  dismissed: number // penny bank-checks cancelled out
  byBucket: Record<string, number>
  error?: string
}

export async function POST(req: Request): Promise<NextResponse<Summary>> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(empty('unauthorized'), { status: 401 })
  }
  const me = user.id

  // Pull the uploaded files.
  let files: File[] = []
  try {
    const fd = await req.formData()
    files = fd.getAll('file').filter((f): f is File => f instanceof File)
  } catch {
    // handled below
  }
  if (files.length === 0) {
    return NextResponse.json(empty('no_file'), { status: 400 })
  }

  // Reading a PDF costs AI money, so gate PDFs behind Pro (CSV is free to read).
  const hasPdf = files.some((f) => isPdf(f))
  if (hasPdf) {
    const plan = await getPlan(supabase, me)
    if (!isPro(plan) && !isAdminEmail(user.email)) {
      return NextResponse.json(empty('pro_required'), { status: 402 })
    }
  }

  // 1) Read every file into one list of normalized lines.
  const lines: NormalizedTxn[] = []
  for (const f of files) {
    try {
      if (isPdf(f)) {
        const b64 = Buffer.from(await f.arrayBuffer()).toString('base64')
        const rows = await readStatementPdf(anthropic, SUPPORT_MODEL, b64, 'wellsfargo')
        lines.push(...rows)
      } else {
        // Treat any non-PDF as a Relay-style CSV.
        const text = new TextDecoder('utf-8').decode(await f.arrayBuffer())
        lines.push(...parseAnyBankCsv(text))
      }
    } catch (e) {
      console.error('[statement import] read error:', e)
    }
  }
  if (lines.length === 0) {
    return NextResponse.json(empty('nothing_read'), { status: 200 })
  }

  // 2) Save into the bank feed. The unique (owner, external_id) index means a
  //    line already imported is quietly ignored, so re-uploading is safe.
  const feedRows = lines.map((l) => ({
    owner_user_id: me,
    posted_date: l.postedDate,
    amount: l.amount,
    source: l.source,
    raw_description: l.rawDescription,
    external_id: l.externalId,
    status: 'imported',
    handled: false,
    imported_at: new Date().toISOString(),
  }))
  const { error: upErr } = await supabase
    .from('books_bank_feed')
    .upsert(feedRows, { onConflict: 'owner_user_id,external_id', ignoreDuplicates: true })
  if (upErr) {
    console.error('[statement import] feed upsert error:', upErr)
    return NextResponse.json(empty('feed_save_failed'), { status: 500 })
  }

  // Re-read the feed lines for this batch (authoritative amounts + ids), and
  // only work the ones not already handled by a previous run.
  const ids = lines.map((l) => l.externalId)
  const { data: feed } = await supabase
    .from('books_bank_feed')
    .select('id, amount, posted_date, raw_description, source, handled, external_id')
    .eq('owner_user_id', me)
    .in('external_id', ids)
  const todo = (feed ?? []).filter((r: any) => !r.handled)

  // 3) Look up this operator's buckets by name so we can post into them.
  const { data: accts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('owner_user_id', me)
  const byName = new Map<string, string>()
  for (const a of (accts ?? []) as { id: string; name: string }[]) byName.set(a.name, a.id)
  const acct = (name: string) => byName.get(name) || null

  // If the books aren't set up yet, keep the lines in the feed for review
  // rather than guessing. (Opening the Books page once creates the buckets.)
  const booksReady = !!acct(ACCOUNTS.bank) && !!acct(ACCOUNTS.cash)

  const summary: Summary = {
    ok: true,
    imported: todo.length,
    autoPosted: 0,
    alreadyCounted: 0,
    needLook: 0,
    dismissed: 0,
    byBucket: {},
  }

  // 4) Sort + post each line.
  for (const row of todo as any[]) {
    const txn: NormalizedTxn = {
      postedDate: row.posted_date,
      amount: Number(row.amount),
      rawDescription: row.raw_description || '',
      payee: null,
      externalId: row.external_id,
      source: row.source || '',
    }
    const decision = sortTxn(txn)

    // Lines we can't confidently place (or books not ready) stay for a look.
    if (!booksReady || decision.action === 'review' || !decision.confident) {
      summary.needLook++
      continue
    }

    const posted = await postDecision(supabase, me, row, decision, acct)
    if (posted === 'posted') {
      summary.autoPosted++
      summary.byBucket[decision.label] = (summary.byBucket[decision.label] || 0) + 1
    } else if (posted === 'moved') {
      summary.alreadyCounted++
      summary.byBucket[decision.label] = (summary.byBucket[decision.label] || 0) + 1
    } else if (posted === 'dismissed') {
      summary.dismissed++
    } else {
      summary.needLook++
    }
  }

  return NextResponse.json(summary, { status: 200 })
}

// Write the ledger entry for one decision, then mark the feed line handled.
// Returns what happened so the caller can tally it.
async function postDecision(
  supabase: any,
  me: string,
  row: any,
  d: SortResult,
  acct: (name: string) => string | null
): Promise<'posted' | 'moved' | 'dismissed' | 'skip'> {
  const amount = Math.abs(Number(row.amount))
  const date = row.posted_date as string | null
  const desc = (row.raw_description as string) || d.label

  try {
    if (d.action === 'dismiss') {
      await markHandled(supabase, me, row.id, null)
      return 'dismissed'
    }

    if (d.action === 'transfer') {
      const from = acct(d.fromAccountName || '')
      const to = acct(d.toAccountName || '')
      if (!from || !to) return 'skip'
      const { data, error } = await supabase.rpc('record_transfer', {
        p_date: date,
        p_amount: amount,
        p_from_account_id: from,
        p_to_account_id: to,
        p_note: desc,
      })
      if (error) return 'skip'
      await markHandled(supabase, me, row.id, data as string)
      return 'moved'
    }

    if (d.action === 'income') {
      const bank = acct(ACCOUNTS.bank)
      const credit = acct(d.accountName || '')
      if (!bank || !credit) return 'skip'
      const { data, error } = await supabase.rpc('record_cash_sale', {
        p_date: date,
        p_amount: amount,
        p_asset_account_id: bank,
        p_income_account_id: credit,
        p_description: desc,
        p_memo: null,
        p_piece_id: null,
        p_contact_id: null,
      })
      if (error) return 'skip'
      await markHandled(supabase, me, row.id, data as string)
      return 'posted'
    }

    // action === 'expense' (materials, fuel, software, advertising, fees, draw)
    const bank = acct(ACCOUNTS.bank)
    const expense = acct(d.accountName || '')
    if (!bank || !expense) return 'skip'
    const { data, error } = await supabase.rpc('record_expense', {
      p_date: date,
      p_amount: amount,
      p_expense_account_id: expense,
      p_paid_from_account_id: bank,
      p_description: desc,
      p_memo: null,
      p_piece_id: null,
      p_contact_id: null,
    })
    if (error) return 'skip'
    await markHandled(supabase, me, row.id, data as string)
    return 'posted'
  } catch (e) {
    console.error('[statement import] post error:', e)
    return 'skip'
  }
}

async function markHandled(
  supabase: any,
  me: string,
  feedId: string,
  txnId: string | null
): Promise<void> {
  await supabase
    .from('books_bank_feed')
    .update({ handled: true, status: 'sorted', transaction_id: txnId })
    .eq('id', feedId)
    .eq('owner_user_id', me)
}

function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')
}

function empty(error?: string): Summary {
  return {
    ok: !error,
    imported: 0,
    autoPosted: 0,
    alreadyCounted: 0,
    needLook: 0,
    dismissed: 0,
    byBucket: {},
    error,
  }
}
