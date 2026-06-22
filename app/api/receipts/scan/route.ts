import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, SUPPORT_MODEL } from '@/lib/anthropic'
import { getPlan, isPro, isAdminEmail } from '@/lib/plan'

// POST /api/receipts/scan
// Body: FormData with a single image "file".
// Returns { ok, vendor, amount, date } read from the receipt by the AI.
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Pro-only (AI has a real per-scan cost).
  const plan = await getPlan(supabase, user.id)
  if (!isPro(plan) && !isAdminEmail(user.email)) {
    return NextResponse.json({ ok: false, error: 'pro_required' }, { status: 402 })
  }

  let file: File | null = null
  try {
    const fd = await req.formData()
    file = fd.get('file') as File | null
  } catch {
    // handled below
  }
  if (!file) {
    return NextResponse.json({ ok: false, error: 'no_file' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const base64 = buf.toString('base64')
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const mediaType = allowed.includes(file.type) ? file.type : 'image/jpeg'

  try {
    const resp = await anthropic.messages.create({
      model: SUPPORT_MODEL,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as any,
                data: base64,
              },
            },
            {
              type: 'text',
              text:
                'Read this store receipt. Reply with ONLY a JSON object, nothing ' +
                'else: {"vendor": string|null, "date": "YYYY-MM-DD"|null, "total": ' +
                'number|null, "items": [{"description": string, "amount": number}]}. ' +
                '"total" is the grand total paid. "items" are the individual line ' +
                'items with their prices (skip tax, subtotal, and total lines). Use ' +
                'null or [] for anything you cannot read.',
            },
          ],
        },
      ],
    })

    const text = resp.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim()
    const clean = text.replace(/```json|```/g, '').trim()

    let parsed: any = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      // leave parsed empty -> user fills manually
    }

    const total =
      typeof parsed.total === 'number'
        ? parsed.total
        : parsed.total
        ? Number(parsed.total)
        : null

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((it: any) => ({
            description: typeof it?.description === 'string' ? it.description : '',
            amount:
              typeof it?.amount === 'number'
                ? it.amount
                : it?.amount
                ? Number(it.amount)
                : null,
          }))
          .filter((it: any) => Number.isFinite(it.amount))
      : []

    return NextResponse.json({
      ok: true,
      vendor: parsed.vendor ?? null,
      date: parsed.date ?? null,
      total: Number.isFinite(total) ? total : null,
      items,
    })
  } catch (e: any) {
    console.error('[receipt scan] error:', e)
    return NextResponse.json({ ok: false, error: 'scan_failed' }, { status: 500 })
  }
}
