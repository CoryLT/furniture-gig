import Link from 'next/link'
import { MailX, CheckCircle2, Mail } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import ResubscribeButton from './ResubscribeButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================================
// /unsubscribe/[token]
// ============================================================
// One-click unsubscribe. The token in the URL is
// notification_preferences.unsubscribe_token, generated per-user
// by our SQL migration. The user does NOT need to be signed in —
// CAN-SPAM requires that unsub work from just the link.
//
// Visiting the URL toggles email_marketing to false immediately.
// We show a confirmation page with a "resubscribe" button in case
// they got here by accident (or a preview fetcher followed the
// link on their behalf).
// ============================================================

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string }
}) {
  const token = (params.token || '').trim()
  const admin = createAdminClient()

  // Look up the row by token so we know who to unsubscribe. We
  // pull user_id + email so we can show the address they've been
  // unsubbed from.
  const { data: prefRow } = await admin
    .from('notification_preferences')
    .select('user_id, email_marketing, unsubscribe_token')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  const validToken = !!prefRow

  // If the token doesn't exist, show a friendly error state and
  // stop — do NOT reveal whether the token was ever valid.
  if (!validToken) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Mail className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-serif text-foreground">
            This unsubscribe link isn&rsquo;t recognized
          </h1>
          <p className="text-sm text-muted-foreground">
            The link may have expired, or it may not be a FlipWork
            unsubscribe link. If you meant to opt out of FlipWork
            emails, please reply to any FlipWork email and we&rsquo;ll
            take care of it manually.
          </p>
          <Link
            href="/"
            className="inline-block text-sm underline hover:text-foreground"
          >
            Return to FlipWork
          </Link>
        </div>
      </main>
    )
  }

  // Grab the account email for the confirmation copy.
  const { data: userRow } = await admin
    .from('users')
    .select('email')
    .eq('id', (prefRow as any).user_id)
    .maybeSingle()
  const email = (userRow as any)?.email as string | undefined

  const alreadyUnsubbed = (prefRow as any).email_marketing === false

  // Flip the flag if it's still on.
  if (!alreadyUnsubbed) {
    await admin
      .from('notification_preferences')
      .update({ email_marketing: false })
      .eq('unsubscribe_token', token)
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
          {alreadyUnsubbed ? (
            <MailX className="w-6 h-6 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          )}
        </div>
        <h1 className="text-2xl font-serif text-foreground">
          {alreadyUnsubbed ? 'Already unsubscribed' : "You're unsubscribed"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              <span className="font-medium text-foreground">{email}</span> will
              no longer receive promotional email from FlipWork. You&rsquo;ll
              still get important account emails (password resets, receipts).
            </>
          ) : (
            <>
              This address will no longer receive promotional email from
              FlipWork. You&rsquo;ll still get important account emails.
            </>
          )}
        </p>

        <ResubscribeButton token={token} />

        <p className="text-xs text-muted-foreground pt-4">
          <Link href="/" className="underline hover:text-foreground">
            Return to FlipWork
          </Link>
        </p>
      </div>
    </main>
  )
}
