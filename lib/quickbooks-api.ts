// QuickBooks API layer.
//
// Sits on top of the OAuth helpers. Its job:
//   1. Read a user's saved connection.
//   2. If the short-lived access token is expired (or about to be), use the
//      refresh token to get a new one and save it.
//   3. Make authenticated calls to the QuickBooks company API.

import { createAdminClient } from '@/lib/supabase/admin'
import { QBO_TOKEN_URL, qbBasicAuth, type QBTokens } from '@/lib/quickbooks'

const API_BASE: Record<'sandbox' | 'production', string> = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com',
  production: 'https://quickbooks.api.intuit.com',
}

export type QBConnection = {
  realmId: string
  accessToken: string
  environment: 'sandbox' | 'production'
}

// Trade a refresh token for a fresh access token (and a fresh refresh token).
async function refreshAccessToken(refreshToken: string): Promise<QBTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: qbBasicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    throw new Error(`QuickBooks token refresh failed (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as QBTokens
}

// Get the user's connection with a valid access token, refreshing if needed.
// Returns null if the user has no QuickBooks connection saved.
export async function getFreshConnection(userId: string): Promise<QBConnection | null> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('quickbooks_connections')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (!row) return null

  const now = Date.now()
  const accessExp = row.access_expires_at ? new Date(row.access_expires_at).getTime() : 0
  let accessToken: string = row.access_token

  // Refresh if expired or within 5 minutes of expiring.
  if (!accessExp || accessExp - now < 5 * 60 * 1000) {
    const t = await refreshAccessToken(row.refresh_token)
    accessToken = t.access_token
    await admin
      .from('quickbooks_connections')
      .update({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        access_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
        refresh_expires_at: new Date(
          now + t.x_refresh_token_expires_in * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('owner_user_id', userId)
  }

  return {
    realmId: row.realm_id,
    accessToken,
    environment: (row.environment as 'sandbox' | 'production') ?? 'sandbox',
  }
}

// Make a call to the QuickBooks company API. `path` is everything after
// /v3/company/{realmId}/ — e.g. "companyinfo/123" or "purchase".
export async function qboFetch(
  conn: QBConnection,
  path: string,
  init?: RequestInit
): Promise<any> {
  const url = `${API_BASE[conn.environment]}/v3/company/${conn.realmId}/${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    throw new Error(`QuickBooks API ${res.status}: ${text.slice(0, 300)}`)
  }
  return json
}
