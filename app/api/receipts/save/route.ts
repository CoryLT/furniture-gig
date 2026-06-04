import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFreshConnection, qboFetch } from '@/lib/quickbooks-api'

// POST /api/receipts/save
// FormData: file, vendor, date (YYYY-MM-DD), lines (JSON array of
//   { description, amount, category, pieceId|null })
//
// Creates ONE QuickBooks expense with a line per receipt line, attaches the
// photo once, and for lines tagged to a piece also records a piece cost (so it
// shows in profit) plus an "already-sent" marker so the piece sync won't repost.
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let fd: FormData
  try {
    fd = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const file = fd.get('file') as File | null
  const vendor = String(fd.get('vendor') || '').trim()
  const date = String(fd.get('date') || '').trim()

  let lines: Array<{
    description: string
    amount: number
    category: string
    pieceId: string | null
  }> = []
  try {
    const raw = JSON.parse(String(fd.get('lines') || '[]'))
    lines = (Array.isArray(raw) ? raw : [])
      .map((l: any) => ({
        description: String(l?.description || '').trim(),
        amount: Number(l?.amount),
        category: String(l?.category || 'other'),
        pieceId: l?.pieceId ? String(l.pieceId) : null,
      }))
      .filter((l) => Number.isFinite(l.amount) && l.amount > 0)
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_lines' }, { status: 400 })
  }
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_lines' }, { status: 400 })
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
    .select('paid_from_account_id, category_map')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  const paidFromId = settings?.paid_from_account_id || ''
  const categoryMap: Record<string, string> = (settings?.category_map as any) || {}
  if (!paidFromId || Object.keys(categoryMap).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_mapping' }, { status: 400 })
  }

  // Which pieces actually belong to this user (so a tag can't point elsewhere).
  const { data: ownPieces } = await supabase
    .from('inventory_pieces')
    .select('id')
    .eq('owner_user_id', user.id)
  const ownPieceIds = new Set((ownPieces || []).map((p: any) => p.id))

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

  // Build one Purchase with a line per receipt line.
  const qboLines: any[] = []
  const lineMeta: Array<{ pieceId: string | null; amount: number; category: string; note: string }> = []
  for (const l of lines) {
    const acct = categoryMap[l.category] || categoryMap['other']
    if (!acct) continue
    const note = l.description || vendor || 'Receipt item'
    qboLines.push({
      Amount: l.amount,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: { AccountRef: { value: acct } },
      Description: note,
    })
    lineMeta.push({
      pieceId: l.pieceId && ownPieceIds.has(l.pieceId) ? l.pieceId : null,
      amount: l.amount,
      category: l.category,
      note,
    })
  }
  if (qboLines.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_mapped_lines' }, { status: 400 })
  }

  const purchase: any = {
    PaymentType: paymentType,
    AccountRef: { value: paidFromId },
    PrivateNote: `${vendor || 'Receipt'} — FlipWork`,
    Line: qboLines,
  }
  if (date) purchase.TxnDate = date

  let purchaseId: string | null = null
  try {
    const created = await qboFetch(conn, 'purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchase),
    })
    purchaseId = created?.Purchase?.Id ?? null
  } catch (e: any) {
    console.error('[receipt save] purchase error:', e)
    return NextResponse.json(
      { ok: false, error: 'create_failed', detail: String(e?.message || e) },
      { status: 500 }
    )
  }

  // Attach the photo once.
  let attached = false
  if (purchaseId && file) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const contentType = file.type || 'image/jpeg'
      const fileName = file.name || 'receipt.jpg'
      const meta = {
        AttachableRef: [{ EntityRef: { type: 'Purchase', value: purchaseId } }],
        FileName: fileName,
        ContentType: contentType,
      }
      const form = new FormData()
      form.append(
        'file_metadata_01',
        new Blob([JSON.stringify(meta)], { type: 'application/json' }),
        'metadata.json'
      )
      form.append('file_content_01', new Blob([buf], { type: contentType }), fileName)
      await qboFetch(conn, 'upload', { method: 'POST', body: form })
      attached = true
    } catch (e) {
      console.error('[receipt save] attach error:', e)
    }
  }

  // For lines tagged to a piece: record the cost on the piece (for profit) and
  // mark it already-sent so the piece sync won't post it again.
  let tagged = 0
  for (const m of lineMeta) {
    if (!m.pieceId) continue
    try {
      const { data: pe } = await supabase
        .from('piece_expenses')
        .insert({
          piece_id: m.pieceId,
          owner_user_id: user.id,
          amount: m.amount,
          category: m.category,
          note: m.note,
          ...(date ? { spent_on: date } : {}),
        })
        .select('id')
        .single()
      if (pe?.id) {
        await supabase.from('quickbooks_synced').insert({
          owner_user_id: user.id,
          source_type: 'piece_expense',
          source_id: pe.id,
          qbo_type: 'Purchase',
          qbo_id: purchaseId,
          amount: m.amount,
        })
        tagged++
      }
    } catch (e) {
      console.error('[receipt save] piece link error:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    purchaseId,
    attached,
    lines: qboLines.length,
    tagged,
  })
}
