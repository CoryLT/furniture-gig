import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// GET /api/email/test
// ============================================================
// Admin-only smoke test. Sends one test email to the calling
// admin's own address via Resend. Returns whatever sendEmail()
// returned so you can see exactly what happened (sent / failed /
// skipped_duplicate, the Resend message ID, the error message).
//
// Hit this once after deploying + setting RESEND_API_KEY to confirm
// the pipe works end-to-end. If you get 'sent' and the email lands
// in your inbox, Phase 1 is healthy.
// ============================================================

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Admin check — only role='admin' users can hit this
  const { data: userRow } = await supabase
    .from('users')
    .select('id, role, email' as any)
    .eq('id', user.id)
    .maybeSingle()

  if (!userRow || (userRow as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = (userRow as any).email as string | null
  if (!email) {
    return NextResponse.json(
      { error: 'No email on file for the admin user' },
      { status: 400 }
    )
  }

  const result = await sendEmail({
    recipientUserId: user.id,
    recipientEmail: email,
    eventType: 'test',
    subject: 'FlipWork: email pipeline test',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">Email pipeline working ✓</h1>
        <p style="font-size: 14px; line-height: 1.5; color: #444;">
          If you're reading this, Resend is configured correctly and
          FlipWork can send transactional email.
        </p>
        <p style="font-size: 12px; color: #888; margin-top: 24px;">
          This is a test email. Do not reply.
        </p>
      </div>
    `,
    text: 'Email pipeline working. If you can read this, Resend is configured correctly.',
    // Use a unique key per test so you can hit this multiple times
    idempotencyKey: `test:${user.id}:${Date.now()}`,
  })

  return NextResponse.json({
    ok: result.status === 'sent',
    ...result,
  })
}
