// ============================================================
// FlipWork — Email helper (Resend wrapper)
// ============================================================
// All outbound transactional email goes through sendEmail() below.
// Responsibilities:
//   1. Check the recipient's notification_preferences — bail if they
//      have the relevant toggle OFF.
//   2. Check email_log for the idempotency_key — bail if already
//      sent (e.g. a trigger fired twice).
//   3. Call Resend to actually send.
//   4. Write an email_log row with status (sent / failed /
//      skipped_preferences / skipped_duplicate).
//
// Designed to be called from server-side code only (API routes,
// server actions). Uses the SERVICE-ROLE Supabase client so it can
// write to email_log (which is RLS-locked from clients).
//
// Failures are LOGGED but NEVER THROWN. The principle: never let
// an email send failure block the actual app action (e.g. picking
// a worker shouldn't fail because Resend has a hiccup).
// ============================================================

import { Resend } from 'resend'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// ---- Resend client (lazy / null if no key) ----
if (!process.env.RESEND_API_KEY) {
  console.warn(
    'RESEND_API_KEY is not set. Email sending will be skipped at runtime.'
  )
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// ---- Sender + reply-to ----
const FROM_ADDRESS = 'FlipWork <notifications@myflipwork.com>'
// "Do not reply" — we deliberately do NOT set a reply-to. Resend will
// surface the From address as the reply target, but it goes nowhere
// (no mailbox configured for notifications@). Email footers should
// point users to /support instead.

// ---- Service-role Supabase client ----
// We use the service role so we can read notification_preferences
// (RLS doesn't apply to service role) and insert into email_log
// (also RLS-locked from regular clients).
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn(
      'Supabase service role env vars missing. Email helper degraded.'
    )
    return null
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ============================================================
// Public API
// ============================================================

export type EmailEventType =
  | 'gig_picked'
  | 'gig_rejected'
  | 'new_message'
  | 'tax_1099_threshold'
  | 'test'

// Map each event type to the column on notification_preferences
// that controls it. 'test' is for our smoke-test endpoint and
// always sends.
const EVENT_TO_PREFERENCE_COLUMN: Record<EmailEventType, string | null> = {
  gig_picked: 'email_picked',
  gig_rejected: 'email_rejected',
  new_message: 'email_messages',
  tax_1099_threshold: null,
  test: null,
}

export interface SendEmailArgs {
  recipientUserId: string | null // null only for unusual cases like admin alerts
  recipientEmail: string
  eventType: EmailEventType
  subject: string
  html: string
  text: string // plain-text fallback for clients that prefer it
  // For dedup: a stable key tied to the underlying event so the
  // same notification doesn't go out twice. e.g. for gig_picked:
  // 'gig_picked:<gig_id>:<worker_user_id>'. Pass null to skip dedup.
  idempotencyKey: string | null
  // Optional: what entity this email is about. Stored on email_log.
  relatedEntityId?: string | null
}

export interface SendEmailResult {
  status: 'sent' | 'failed' | 'skipped_preferences' | 'skipped_duplicate'
  resendMessageId?: string
  errorMessage?: string
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const supabase = getServiceClient()
  if (!supabase) {
    return { status: 'failed', errorMessage: 'Service client unavailable' }
  }

  // 1) Idempotency check — have we already sent this exact email?
  if (args.idempotencyKey) {
    const { data: existing } = await supabase
      .from('email_log')
      .select('id, status')
      .eq('idempotency_key', args.idempotencyKey)
      .maybeSingle()

    if (existing) {
      // Already attempted. Whatever its status was, don't re-send.
      return { status: 'skipped_duplicate' }
    }
  }

  // 2) Preference check
  const prefCol = EVENT_TO_PREFERENCE_COLUMN[args.eventType]
  if (prefCol && args.recipientUserId) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefCol)
      .eq('user_id', args.recipientUserId)
      .maybeSingle()

    // If the column is explicitly false, skip. If the row doesn't
    // exist at all (somehow), default to "send" (the backfill should
    // mean every user has one, but defensive).
    if (prefs && (prefs as any)[prefCol] === false) {
      await logSkippedPreferences(supabase, args)
      return { status: 'skipped_preferences' }
    }
  }

  // 3) Send via Resend
  if (!resend) {
    // No API key. Log + return failure (don't throw).
    await logFailed(supabase, args, 'RESEND_API_KEY not configured')
    return { status: 'failed', errorMessage: 'Resend not configured' }
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: args.recipientEmail,
      subject: args.subject,
      html: args.html,
      text: args.text,
    })

    if (result.error) {
      await logFailed(supabase, args, String(result.error.message ?? result.error))
      return { status: 'failed', errorMessage: String(result.error.message ?? result.error) }
    }

    const messageId = result.data?.id ?? ''
    await logSent(supabase, args, messageId)
    return { status: 'sent', resendMessageId: messageId }
  } catch (err: any) {
    const message = err?.message ?? String(err)
    await logFailed(supabase, args, message)
    return { status: 'failed', errorMessage: message }
  }
}

// ============================================================
// Internal: write the email_log row
// ============================================================

async function logSent(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  args: SendEmailArgs,
  resendMessageId: string
) {
  await supabase.from('email_log').insert({
    recipient_user_id: args.recipientUserId,
    recipient_email: args.recipientEmail,
    event_type: args.eventType,
    related_entity_id: args.relatedEntityId ?? null,
    resend_message_id: resendMessageId,
    status: 'sent',
    idempotency_key: args.idempotencyKey,
  } as any)
}

async function logFailed(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  args: SendEmailArgs,
  errorMessage: string
) {
  // Note: do NOT use idempotency_key on a failed send — we want the
  // next attempt to be allowed through. So we set it to null on
  // failures to keep the unique constraint from blocking retries.
  await supabase.from('email_log').insert({
    recipient_user_id: args.recipientUserId,
    recipient_email: args.recipientEmail,
    event_type: args.eventType,
    related_entity_id: args.relatedEntityId ?? null,
    status: 'failed',
    error_message: errorMessage,
    idempotency_key: null,
  } as any)
}

async function logSkippedPreferences(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  args: SendEmailArgs
) {
  // Skipped because preference is OFF. We DO write the idempotency
  // key so we don't repeatedly attempt the same skipped send.
  await supabase.from('email_log').insert({
    recipient_user_id: args.recipientUserId,
    recipient_email: args.recipientEmail,
    event_type: args.eventType,
    related_entity_id: args.relatedEntityId ?? null,
    status: 'skipped_preferences',
    idempotency_key: args.idempotencyKey,
  } as any)
}
