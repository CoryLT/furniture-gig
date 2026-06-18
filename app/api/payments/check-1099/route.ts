import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { sendEmail } from '@/lib/email'

// POST /api/payments/check-1099
// Body: { workerId: string, amountPaid: number }
//
// Called right after an operator marks a worker paid. If that payment pushes
// the worker's total for the current tax year across the 1099 threshold
// ($600 through 2025, $2,000 for 2026+), we alert the operator once — in-app,
// push, and email — so they know to expect a 1099 filing for that person.
//
// Best-effort: never blocks the payment. Fires only on the crossing payment,
// and a guard prevents duplicates per worker per year.
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

  let workerId = ''
  let amountPaid = 0
  try {
    const body = await req.json()
    workerId = String(body?.workerId || '')
    amountPaid = Number(body?.amountPaid) || 0
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  if (!workerId) return NextResponse.json({ ok: false, error: 'no_worker' }, { status: 400 })

  const year = new Date().getFullYear()
  const limit = threshold(year)

  // Sum everything I've marked paid to this worker THIS tax year.
  const { data: payRaw } = await supabase
    .from('gig_payments')
    .select('amount, marked_paid_at')
    .eq('flipper_user_id', me)
    .eq('worker_user_id', workerId)
    .not('marked_paid_at', 'is', null)
  const totalAfter = ((payRaw ?? []) as any[])
    .filter((p) => p.marked_paid_at && new Date(p.marked_paid_at).getFullYear() === year)
    .reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalBefore = totalAfter - amountPaid

  // Only the payment that actually crosses the line fires the alert.
  const crossed = totalBefore < limit && totalAfter >= limit
  if (!crossed) {
    return NextResponse.json({ ok: true, crossed: false })
  }

  const admin = createAdminClient()

  // Guard against duplicates (e.g. an edited/re-saved payment re-crossing).
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('recipient_user_id', me)
    .eq('type', '1099_threshold')
    .eq('data->>worker_user_id', workerId)
    .eq('data->>year', String(year))
    .limit(1)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, crossed: true, alreadyNotified: true })
  }

  // Worker's display name.
  const { data: prof } = await admin
    .from('worker_profiles')
    .select('full_name, first_name, last_name, username')
    .eq('user_id', workerId)
    .maybeSingle()
  const p = (prof as any) || {}
  const name =
    (p.full_name || '').trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
    p.username ||
    'this worker'

  const totalLabel = `$${totalAfter.toFixed(2)}`

  // 1) In-app notification (bell). Inserted with the service role because the
  //    notifications table has no client INSERT policy.
  await admin.from('notifications').insert({
    recipient_user_id: me,
    actor_user_id: workerId,
    type: '1099_threshold',
    data: { worker_user_id: workerId, worker_name: name, year, total: totalAfter },
  })

  // 2) Push (phone buzz).
  await sendPushToUser({
    userId: me,
    title: '1099 threshold reached',
    body: `You've paid ${name} ${totalLabel} this year — you'll likely need to file a 1099.`,
    url: '/flipper/records',
    tag: `1099-${workerId}-${year}`,
  })

  // 3) Email (deduped per worker/year).
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
      idempotencyKey: `tax_1099_threshold:${me}:${workerId}:${year}`,
      relatedEntityId: workerId,
    })
  }

  return NextResponse.json({ ok: true, crossed: true })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
