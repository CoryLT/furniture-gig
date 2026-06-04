import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFreshConnection, qboFetch } from '@/lib/quickbooks-api'

// POST /api/receipts/save
// FormData: file, vendor, amount, date (YYYY-MM-DD), categoryId, paidFromId, paymentType
// Creates an expense in QuickBooks and attaches the receipt photo (best effort).
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
  const amount = Number(fd.get('amount'))
  const date = String(fd.get('date') || '').trim()
  const categoryId = String(fd.get('categoryId') || '').trim()
  const paidFromId = String(fd.get('paidFromId') || '').trim()
  const paymentType =
    String(fd.get('paymentType') || 'Cash') === 'CreditCard' ? 'CreditCard' : 'Cash'

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'bad_amount' }, { status: 400 })
  }
  if (!categoryId || !paidFromId) {
    return NextResponse.json({ ok: false, error: 'missing_account' }, { status: 400 })
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

  // 1) Create the expense (Purchase).
  const purchase: any = {
    PaymentType: paymentType,
    AccountRef: { value: paidFromId },
    PrivateNote: vendor ? `${vendor} — added via FlipWork` : 'Added via FlipWork',
    Line: [
      {
        Amount: amount,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: { AccountRef: { value: categoryId } },
        ...(vendor ? { Description: vendor } : {}),
      },
    ],
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

  // 2) Attach the receipt image (best effort — the expense is already saved).
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

  return NextResponse.json({ ok: true, purchaseId, attached })
}
