import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/receipts/save
// FormData: file, vendor, date (YYYY-MM-DD), paidFromAccountId, lines (JSON array
//   of { description, amount, expenseAccountId, pieceId|null })
//
// Logs each line as a real expense in the owner's books (the double-entry
// ledger, via the record_expense function), tags it to a piece when chosen,
// records the vendor as a contact, and attaches the receipt photo to every
// entry it creates. No QuickBooks involved.
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
  const paidFromAccountId = String(fd.get('paidFromAccountId') || '').trim()
  const today = new Date().toISOString().slice(0, 10)
  const useDate = date || today

  let lines: Array<{
    description: string
    amount: number
    expenseAccountId: string
    pieceId: string | null
  }> = []
  try {
    const raw = JSON.parse(String(fd.get('lines') || '[]'))
    lines = (Array.isArray(raw) ? raw : [])
      .map((l: any) => ({
        description: String(l?.description || '').trim(),
        amount: Number(l?.amount),
        expenseAccountId: String(l?.expenseAccountId || '').trim(),
        pieceId: l?.pieceId ? String(l.pieceId) : null,
      }))
      .filter((l) => Number.isFinite(l.amount) && l.amount > 0)
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_lines' }, { status: 400 })
  }
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_lines' }, { status: 400 })
  }
  if (!paidFromAccountId) {
    return NextResponse.json({ ok: false, error: 'no_paid_from' }, { status: 400 })
  }

  // Load the owner's own accounts + pieces so a line can't point somewhere else.
  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, type')
    .eq('owner_user_id', user.id)
  const expenseIds = new Set(
    (accountsRaw || []).filter((a: any) => a.type === 'expense').map((a: any) => a.id)
  )
  const assetIds = new Set(
    (accountsRaw || []).filter((a: any) => a.type === 'asset').map((a: any) => a.id)
  )
  if (!assetIds.has(paidFromAccountId)) {
    return NextResponse.json({ ok: false, error: 'bad_paid_from' }, { status: 400 })
  }

  const { data: ownPieces } = await supabase
    .from('inventory_pieces')
    .select('id')
    .eq('owner_user_id', user.id)
  const ownPieceIds = new Set((ownPieces || []).map((p: any) => p.id))

  // Keep only lines whose category is one of the owner's expense accounts.
  const goodLines = lines.filter((l) => expenseIds.has(l.expenseAccountId))
  if (goodLines.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_category' }, { status: 400 })
  }

  // Vendor -> contact (find existing by name, else create one of type 'vendor').
  let contactId: string | null = null
  if (vendor) {
    try {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_user_id', user.id)
        .ilike('name', vendor)
        .limit(1)
        .maybeSingle()
      if (existing?.id) {
        contactId = existing.id
      } else {
        const { data: created } = await supabase
          .from('contacts')
          .insert({ owner_user_id: user.id, name: vendor, type: 'vendor' })
          .select('id')
          .single()
        contactId = created?.id ?? null
      }
    } catch {
      contactId = null
    }
  }

  // Upload the receipt photo once to the private gig-photos bucket.
  let receiptPath: string | null = null
  if (file) {
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      const ext = (file.type && file.type.split('/')[1]) || 'jpg'
      const path = `${user.id}/receipts/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('gig-photos')
        .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: false })
      if (!upErr) receiptPath = path
    } catch {
      receiptPath = null
    }
  }

  // Log each line as its own balanced expense entry, all sharing the photo.
  let saved = 0
  let tagged = 0
  let attached = false
  for (const l of goodLines) {
    const pieceId = l.pieceId && ownPieceIds.has(l.pieceId) ? l.pieceId : null
    const description = l.description || vendor || 'Receipt item'
    try {
      const { data: txnId, error: rpcErr } = await supabase.rpc('record_expense', {
        p_date: useDate,
        p_amount: l.amount,
        p_expense_account_id: l.expenseAccountId,
        p_paid_from_account_id: paidFromAccountId,
        p_description: description,
        p_memo: vendor || null,
        p_piece_id: pieceId,
        p_contact_id: contactId,
      })
      if (rpcErr || !txnId) continue
      saved++
      if (pieceId) tagged++
      if (receiptPath) {
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ receipt_path: receiptPath })
          .eq('id', txnId as string)
          .eq('owner_user_id', user.id)
        if (!updErr) attached = true
      }
    } catch (e) {
      console.error('[receipt save] record_expense error:', e)
    }
  }

  if (saved === 0) {
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lines: saved, tagged, attached })
}
