import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, SUPPORT_MODEL } from '@/lib/anthropic'

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
      max_tokens: 300,
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
                'Read this store receipt. Reply with ONLY a JSON object and nothing ' +
                'else: {"vendor": string|null, "amount": number|null, "date": ' +
                '"YYYY-MM-DD"|null}. "amount" is the final grand total actually paid. ' +
                'Use null for anything you cannot read.',
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
      // leave parsed empty -> all nulls, user fills manually
    }

    const amount =
      typeof parsed.amount === 'number'
        ? parsed.amount
        : parsed.amount
        ? Number(parsed.amount)
        : null

    return NextResponse.json({
      ok: true,
      vendor: parsed.vendor ?? null,
      amount: Number.isFinite(amount) ? amount : null,
      date: parsed.date ?? null,
    })
  } catch (e: any) {
    console.error('[receipt scan] error:', e)
    return NextResponse.json({ ok: false, error: 'scan_failed' }, { status: 500 })
  }
}
