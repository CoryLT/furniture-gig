import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFreshConnection, qboFetch } from '@/lib/quickbooks-api'

// GET /api/quickbooks/test
// Proves the connection works end-to-end: refreshes the token if needed and
// reads the company name back from QuickBooks.
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const conn = await getFreshConnection(user.id)
    if (!conn) {
      return NextResponse.json({ ok: false, error: 'not_connected' }, { status: 400 })
    }
    const data = await qboFetch(conn, `companyinfo/${conn.realmId}`)
    const companyName = data?.CompanyInfo?.CompanyName ?? null
    return NextResponse.json({ ok: true, companyName })
  } catch (e: any) {
    console.error('[quickbooks] test error:', e)
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    )
  }
}
