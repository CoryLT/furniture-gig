import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/quickbooks/settings  -> { ok, paidFromAccountId, categoryMap }
// POST /api/quickbooks/settings -> body { paidFromAccountId, categoryMap }
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('quickbooks_settings')
    .select('paid_from_account_id, category_map')
    .eq('owner_user_id', user.id)
    .maybeSingle()
  return NextResponse.json({
    ok: true,
    paidFromAccountId: data?.paid_from_account_id ?? '',
    categoryMap: data?.category_map ?? {},
  })
}

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
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const paidFromAccountId =
    typeof body.paidFromAccountId === 'string' ? body.paidFromAccountId : null
  const categoryMap =
    body.categoryMap && typeof body.categoryMap === 'object' ? body.categoryMap : {}

  const admin = createAdminClient()
  const { error } = await admin.from('quickbooks_settings').upsert(
    {
      owner_user_id: user.id,
      paid_from_account_id: paidFromAccountId,
      category_map: categoryMap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'owner_user_id' }
  )
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
