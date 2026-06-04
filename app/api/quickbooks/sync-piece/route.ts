import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFreshConnection, qboFetch } from '@/lib/quickbooks-api'

// POST /api/quickbooks/sync-piece  body { pieceId }
// Sends the piece's acquisition cost + each expense to QuickBooks as expenses,
// using the user's saved category mapping. Skips anything already sent.
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // handled below
  }
  const pieceId = String(body.pieceId || '')
  if (!pieceId) {
    return NextResponse.json({ ok: false, error: 'no_piece' }, { status: 400 })
  }

  let conn
  try {
    conn = await getFreshConnection(user.id)
  } catch {
    conn = null
  }
  if (!conn) {
    return NextResponse.json({ ok: false, error: 'not_connected' }, { status: 400 })
  }

  // Mapping
  const { data: settings } = await supabase
    .from('quickbooks_settings')
    .select(
      'paid_from_account_id, category_map, income_account_id, deposit_to_account_id'
    )
    .eq('owner_user_id', user.id)
    .maybeSingle()
  const paidFromId = settings?.paid_from_account_id || ''
  const categoryMap: Record<string, string> = (settings?.category_map as any) || {}
  const incomeAccountId = settings?.income_account_id || ''
  const depositToAccountId = settings?.deposit_to_account_id || ''
  if (!paidFromId || Object.keys(categoryMap).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_mapping' }, { status: 400 })
  }

  // Piece + expenses (owner-scoped)
  const { data: piece } = await supabase
    .from('inventory_pieces')
    .select('id, title, acquisition_cost, acquired_at, sale_price, sold_at, stage')
    .eq('id', pieceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (!piece) {
    return NextResponse.json({ ok: false, error: 'piece_not_found' }, { status: 404 })
  }
  const { data: expenses } = await supabase
    .from('piece_expenses')
    .select('id, amount, category, note, spent_on')
    .eq('piece_id', pieceId)
    .eq('owner_user_id', user.id)

  // Already-sent set
  const { data: synced } = await supabase
    .from('quickbooks_synced')
    .select('source_type, source_id')
    .eq('owner_user_id', user.id)
  const done = new Set((synced || []).map((s: any) => `${s.source_type}:${s.source_id}`))

  type Item = {
    sourceType: string
    sourceId: string
    amount: number
    category: string
    note: string
    date: string | null
  }
  const items: Item[] = []

  const acq = Number((piece as any).acquisition_cost || 0)
  if (acq > 0 && !done.has(`piece_acquisition:${piece.id}`)) {
    items.push({
      sourceType: 'piece_acquisition',
      sourceId: piece.id,
      amount: acq,
      category: 'purchase',
      note: `${(piece as any).title || 'Piece'} (purchase)`,
      date: (piece as any).acquired_at || null,
    })
  }
  for (const e of (expenses || []) as any[]) {
    const amt = Number(e.amount || 0)
    if (amt > 0 && !done.has(`piece_expense:${e.id}`)) {
      items.push({
        sourceType: 'piece_expense',
        sourceId: e.id,
        amount: amt,
        category: e.category || 'other',
        note: e.note || e.category || `${(piece as any).title || 'Piece'} expense`,
        date: e.spent_on || null,
      })
    }
  }

  const salePrice = Number((piece as any).sale_price || 0)
  const wantSale =
    (piece as any).stage === 'sold' &&
    salePrice > 0 &&
    !done.has(`piece_sale:${piece.id}`)

  if (items.length === 0 && !wantSale) {
    return NextResponse.json({ ok: true, created: 0, alreadyDone: true })
  }

  // Payment type from the paid-from account.
  let paymentType = 'Cash'
  try {
    const q = encodeURIComponent('SELECT * FROM Account WHERE Active = true')
    const accData = await qboFetch(conn, `query?query=${q}`)
    const accs: any[] = accData?.QueryResponse?.Account ?? []
    const pf = accs.find((a) => a.Id === paidFromId)
    if (pf?.AccountType === 'Credit Card') paymentType = 'CreditCard'
  } catch {
    // default Cash
  }

  let created = 0
  const errors: string[] = []
  for (const it of items) {
    const acct = categoryMap[it.category] || categoryMap['other']
    if (!acct) {
      errors.push(`No account mapped for ${it.category}`)
      continue
    }
    const purchase: any = {
      PaymentType: paymentType,
      AccountRef: { value: paidFromId },
      PrivateNote: `${it.note} — FlipWork`,
      Line: [
        {
          Amount: it.amount,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: { AccountRef: { value: acct } },
          Description: it.note,
        },
      ],
    }
    if (it.date) purchase.TxnDate = it.date
    try {
      const createdPurchase = await qboFetch(conn, 'purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchase),
      })
      const qboId = createdPurchase?.Purchase?.Id ?? null
      await supabase.from('quickbooks_synced').insert({
        owner_user_id: user.id,
        source_type: it.sourceType,
        source_id: it.sourceId,
        qbo_type: 'Purchase',
        qbo_id: qboId,
        amount: it.amount,
      })
      created++
    } catch (e: any) {
      console.error('[sync-piece] item error:', e)
      errors.push(String(e?.message || e).slice(0, 120))
    }
  }

  // Send the sale as income (a deposit booked to the income account).
  if (wantSale) {
    if (!incomeAccountId || !depositToAccountId) {
      errors.push('Set the income mapping to send the sale.')
    } else {
      const soldDate = (piece as any).sold_at
        ? String((piece as any).sold_at).slice(0, 10)
        : null
      const deposit: any = {
        DepositToAccountRef: { value: depositToAccountId },
        Line: [
          {
            Amount: salePrice,
            DetailType: 'DepositLineDetail',
            DepositLineDetail: { AccountRef: { value: incomeAccountId } },
            Description: `${(piece as any).title || 'Piece'} sale`,
          },
        ],
      }
      if (soldDate) deposit.TxnDate = soldDate
      try {
        const createdDep = await qboFetch(conn, 'deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deposit),
        })
        const depId = createdDep?.Deposit?.Id ?? null
        await supabase.from('quickbooks_synced').insert({
          owner_user_id: user.id,
          source_type: 'piece_sale',
          source_id: piece.id,
          qbo_type: 'Deposit',
          qbo_id: depId,
          amount: salePrice,
        })
        created++
      } catch (e: any) {
        console.error('[sync-piece] sale error:', e)
        errors.push(String(e?.message || e).slice(0, 120))
      }
    }
  }

  return NextResponse.json({ ok: true, created, errors })
}
