/**
 * Tools available to the FlipWork support agent.
 *
 * Each tool has:
 *   - a schema (what Claude sees and decides whether to call)
 *   - a handler (server-side function that runs when Claude calls it)
 *
 * All tools are scoped to the calling user's data. The handlers
 * receive userId from the API route and ONLY query data belonging
 * to that user.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ------------------------------------------------------------
// Tool schemas (Anthropic format)
// ------------------------------------------------------------

export const SUPPORT_TOOLS = [
  {
    name: 'get_my_gigs_posted',
    description:
      "Look up gigs the user has POSTED (they're the flipper). Returns title, status, pay amount, applicant count, picked worker, and creation date for each gig.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_my_applications',
    description:
      "Look up gigs the user has APPLIED TO (they're the worker). Returns gig title, application status (pending/active/rejected/etc), and dates.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_my_payouts',
    description:
      "Look up the user's payout records — money they're earning as a worker. Returns gig title, amount, payment status (unpaid/pending/captured/transferred/refunded/failed), and dates.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_my_stripe_status',
    description:
      "Check whether the user has fully connected their Stripe account to receive payments. Returns whether they're ready to receive money or what's blocking them.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'escalate_to_admin',
    description:
      "Flag this conversation for the FlipWork admin (Cory) to review personally. Use this ONLY when the issue is serious — see system prompt for when to escalate. After calling this, tell the user the admin will follow up.",
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          enum: ['refund', 'bug', 'legal', 'abuse_report', 'account', 'unknown', 'human_requested'],
          description: 'Why you are escalating',
        },
        summary: {
          type: 'string',
          description: 'One or two sentence summary of the issue for the admin',
        },
      },
      required: ['reason', 'summary'],
    },
  },
] as const

// ------------------------------------------------------------
// Tool handlers
// ------------------------------------------------------------

type ToolResult = { result: string }

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  conversationId: string
): Promise<ToolResult> {
  // We use the admin (service-role) client because RLS lookups
  // from a server-side context with the user's session can get
  // tangled. The handlers manually filter by userId.
  const supabase = createAdminClient()

  try {
    if (name === 'get_my_gigs_posted') {
      const { data, error } = await supabase
        .from('gigs')
        .select('id, title, status, pay_amount, created_at')
        .or(`poster_user_id.eq.${userId},created_by.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) return { result: `Error: ${error.message}` }
      if (!data || data.length === 0) return { result: 'No gigs posted by this user.' }
      return { result: JSON.stringify(data) }
    }

    if (name === 'get_my_applications') {
      const { data, error } = await supabase
        .from('gig_claims')
        .select('id, gig_id, status, created_at, gigs(title, status, pay_amount)')
        .eq('worker_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) return { result: `Error: ${error.message}` }
      if (!data || data.length === 0) return { result: 'No applications by this user.' }
      return { result: JSON.stringify(data) }
    }

    if (name === 'get_my_payouts') {
      const { data, error } = await supabase
        .from('payout_records')
        .select(
          'id, amount, payout_status, payment_status, created_at, payout_date, gigs(title)'
        )
        .eq('worker_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) return { result: `Error: ${error.message}` }
      if (!data || data.length === 0) return { result: 'No payout records for this user.' }
      return { result: JSON.stringify(data) }
    }

    if (name === 'get_my_stripe_status') {
      const { data, error } = await supabase
        .from('worker_profiles')
        .select(
          'stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_onboarding_completed_at'
        )
        .eq('user_id', userId)
        .maybeSingle()

      if (error) return { result: `Error: ${error.message}` }
      if (!data || !(data as any).stripe_account_id) {
        return {
          result:
            'User has NOT started Stripe onboarding. They need to go to /profile/payments and click "Connect Stripe account."',
        }
      }
      return { result: JSON.stringify(data) }
    }

    if (name === 'escalate_to_admin') {
      const reason = (input.reason as string) || 'unknown'
      const summary = (input.summary as string) || 'No summary provided'

      const { error } = await supabase
        .from('support_conversations')
        .update({
          status: 'escalated',
          escalation_reason: reason,
          summary,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', conversationId)

      if (error) return { result: `Error escalating: ${error.message}` }
      return {
        result: `Conversation escalated. Admin will be notified. Reason: ${reason}.`,
      }
    }

    return { result: `Unknown tool: ${name}` }
  } catch (err: any) {
    return { result: `Tool error: ${err?.message || String(err)}` }
  }
}
