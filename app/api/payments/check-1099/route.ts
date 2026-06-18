import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { sendEmail } from '@/lib/email'

// POST /api/payments/check-1099
// Body: { crewMemberId: string }
//
// Called after you log a labor expense tagged to a worker. If their total for
// the current tax year is at/over the 1099 threshold ($600 through 2025,
// $2,000 for 2026+) and we haven't told you yet, alert once — in-app, push,
// and email. Best-effort; never blocks the expense.
function threshold(year: number): number {
  return year >= 2026 ? 2000 : 600
}

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const me = user.id

  let crewMemberId = ''
  try {
    const body = await req.json()
    crewMemberId = String(body?.crewMemberId || '')
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  if (!crewMemberId) return NextResponse.json({ ok: false, error: 'no_worker' }, { status: 400 })

  const year = new Date().getFullYear()
  const limit = threshold(year)

  // Sum what I've paid this crew member this tax year (labor from the ledger).
  const { data: payRaw } = await supabase
    .from('worker_payments')
    .select('amount, date')
    .eq('owner_user_id', me)
    .eq('crew_member_id', crewMemberId)
  const totalAfter = ((payRaw ?? []) as any[])
    .filter((p) => p.date && new Date(p.date).getFullYear() === year)
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  if (totalAfter < limit) {
    return NextResponse.json({ ok: true, crossed: false })
  }

  const admin = createAdminClient()

  // Fire once per worker per year.
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('recipient_user_id', me)
    .eq('type', '1099_threshold')
    .eq('data->>crew_member_id', crewMemberId)
    .eq('data->>year', String(year))
    .limit(1)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, crossed: true, alreadyNotified: true })
  }

  // Resolve the worker's name from the crew roster (+ profile if on-platform).
  const { data: crew } = await admin
    .from('crew_members')
    .select('worker_user_id, worker_name')
    .eq('id', crewMemberId)
    .eq('operator_user_id', me)
    .maybeSingle()
  if (!crew) return NextResponse.json({ ok: false, error: 'no_crew' }, { status: 400 })
  let name = ((crew as any).worker_name || '').trim()
  if (!name && (crew as any).worker_user_id) {
    const { data: prof } = await admin
      .from('worker_profiles')
      .select('full_name, first_name, last_name, username')
      .eq('user_id', (crew as any).worker_user_id)
      .maybeSingle()
    const p = (prof as any) || {}
    name =
      (p.full_name || '').trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
      p.username ||
      ''
  }
  if (!name) name = 'this worker'

  const totalLabel = `$${totalAfter.toFixed(2)}`

  await admin.from('notifications').insert({
    recipient_user_id: me,
    actor_user_id: null,
    type: '1099_threshold',
    data: { crew_member_id: crewMemberId, worker_name: name, year, total: totalAfter },
  })

  await sendPushToUser({
    userId: me,
    title: '1099 threshold reached',
    body: `You've paid ${name} ${totalLabel} this year — you'll likely need to file a 1099.`,
    url: '/flipper/records',
    tag: `1099-${crewMemberId}-${year}`,
  })

  const { data: meRow } = await admin.from('users').select('email').eq('id', me).maybeSingle()
  const myEmail = (meRow as any)?.email as string | null
  if (myEmail) {
    const recordsUrl = 'https://myflipwork.com/flipper/records'
    await sendEmail({
      recipientUserId: me,
      recipientEmail: myEmail,
      eventType: 'tax_1099_threshold',
      subject: `Heads up: you've reached the 1099 threshold for ${name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
          <h1 style="font-size: 20px; margin: 0 0 12px;">You've crossed the 1099 threshold</h1>
          <p style="font-size: 14px; line-height: 1.5; color: #444;">
            You've now paid <strong>${escapeHtml(name)}</strong> ${totalLabel} in ${year}.
            Once you pay one contractor $${limit.toLocaleString()} or more in a tax year,
            you'll generally need to file a 1099-NEC for them. This is a heads-up, not tax advice.
          </p>
          <p style="margin: 20px 0;">
            <a href="${recordsUrl}" style="display: inline-block; background: hsl(32 90% 48%); color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              View Payment Records
            </a>
          </p>
        </div>
      `,
      text: `You've now paid ${name} ${totalLabel} in ${year}, which crosses the $${limit} 1099 threshold. You'll generally need to file a 1099-NEC. View records: ${recordsUrl}`,
      idempotencyKey: `tax_1099_threshold:${me}:${crewMemberId}:${year}`,
      relatedEntityId: crewMemberId,
    })
  }

  return NextResponse.json({ ok: true, crossed: true })
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
