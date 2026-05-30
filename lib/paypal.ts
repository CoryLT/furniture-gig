// lib/paypal.ts
// ============================================================
// Server-side PayPal REST client for FlipWork.
//
// Reads credentials from environment variables:
//   PAYPAL_CLIENT_ID            - from your PayPal developer app
//   PAYPAL_CLIENT_SECRET        - from your PayPal developer app
//   PAYPAL_ENV                  - 'sandbox' (default) or 'live'
//   PAYPAL_PLATFORM_FEE_PERCENT - your cut, e.g. 2 (default 2)
//
// Start in 'sandbox' so we can test with fake money. Flip to 'live'
// only after testing AND after PayPal approves your Payouts access.
// ============================================================

const PAYPAL_ENV = (process.env.PAYPAL_ENV ?? 'sandbox').toLowerCase()

export const PAYPAL_BASE_URL =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

export function getPayPalEnv(): 'sandbox' | 'live' {
  return PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
}

/**
 * Platform fee percentage (e.g. 2 = 2%). Defaults to 2 if unset.
 */
export function getPlatformFeePercent(): number {
  const raw = process.env.PAYPAL_PLATFORM_FEE_PERCENT
  if (!raw) return 2
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 2
}

export interface PayPalAccessToken {
  access_token: string
  token_type: string
  app_id?: string
  expires_in: number
  scope?: string
}

/**
 * Exchange the client ID + secret for a short-lived access token.
 * Succeeding proves the credentials are valid. The returned `scope`
 * string lists what this app is allowed to do (e.g. Payouts).
 */
export async function getPayPalAccessToken(): Promise<PayPalAccessToken> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !secret) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not set')
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  const data = await res.json()
  if (!res.ok) {
    const detail = `${data?.error ?? ''} ${data?.error_description ?? ''}`.trim()
    throw new Error(`PayPal token request failed (HTTP ${res.status}): ${detail}`)
  }
  return data as PayPalAccessToken
}
