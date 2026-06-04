import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFreshConnection, qboFetch } from '@/lib/quickbooks-api'

// GET /api/quickbooks/accounts
// Returns the user's QuickBooks accounts split into:
//   paidFrom   - where money came from (bank / credit card / cash)
//   categories - expense accounts to file the cost under
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

    const query = encodeURIComponent('SELECT * FROM Account WHERE Active = true')
    const data = await qboFetch(conn, `query?query=${query}`)
    const accounts: any[] = data?.QueryResponse?.Account ?? []

    const paidFrom = accounts
      .filter((a) =>
        ['Bank', 'Credit Card', 'Other Current Asset'].includes(a.AccountType)
      )
      .map((a) => ({
        id: a.Id,
        name: a.Name,
        paymentType: a.AccountType === 'Credit Card' ? 'CreditCard' : 'Cash',
      }))

    const categories = accounts
      .filter((a) => a.Classification === 'Expense')
      .map((a) => ({ id: a.Id, name: a.Name }))

    const income = accounts
      .filter((a) => a.Classification === 'Revenue')
      .map((a) => ({ id: a.Id, name: a.Name }))

    const bank = accounts
      .filter((a) => ['Bank', 'Other Current Asset'].includes(a.AccountType))
      .map((a) => ({ id: a.Id, name: a.Name }))

    return NextResponse.json({ ok: true, paidFrom, categories, income, bank })
  } catch (e: any) {
    console.error('[quickbooks] accounts error:', e)
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    )
  }
}
