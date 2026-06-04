// QuickBooks Online OAuth helpers.
//
// The connect flow in plain terms:
//   1. We send the user to Intuit with our app id.
//   2. The user approves the connection there.
//   3. Intuit sends them back to our callback with a one-time code.
//   4. We trade that code for an access token + refresh token and save them.
//
// All values come from environment variables set in Vercel:
//   QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET,
//   QUICKBOOKS_REDIRECT_URI, QUICKBOOKS_ENVIRONMENT (sandbox|production)

export const QBO_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'
export const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
export const QBO_SCOPE = 'com.intuit.quickbooks.accounting'

export function qbConfig() {
  return {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
    environment: (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox') as
      | 'sandbox'
      | 'production',
  }
}

// True once the three required keys are present in the environment.
export function qbIsConfigured(): boolean {
  const c = qbConfig()
  return Boolean(c.clientId && c.clientSecret && c.redirectUri)
}

export function qbBasicAuth(): string {
  const { clientId, clientSecret } = qbConfig()
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

// The URL we send the user to so they can approve the connection.
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = qbConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: QBO_SCOPE,
    redirect_uri: redirectUri,
    state,
  })
  return `${QBO_AUTHORIZE_URL}?${params.toString()}`
}

export type QBTokens = {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
}

// Trade the one-time code from the callback for real tokens.
export async function exchangeCodeForTokens(code: string): Promise<QBTokens> {
  const { redirectUri } = qbConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
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
    const text = await res.text()
    throw new Error(`QuickBooks token exchange failed (${res.status}): ${text}`)
  }
  return (await res.json()) as QBTokens
}

// Best-effort: ask Intuit to forget the token when the user disconnects.
// We always remove our local copy regardless of whether this succeeds.
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(QBO_REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: qbBasicAuth(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token }),
    })
  } catch {
    // ignore
  }
}
