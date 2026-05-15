import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const MAX_CHUNK_SIZE = 3180

function createChunks(key: string, value: string): Array<{ name: string; value: string }> {
  let encodedValue = encodeURIComponent(value)
  if (encodedValue.length <= MAX_CHUNK_SIZE) {
    return [{ name: key, value }]
  }
  const chunks: string[] = []
  while (encodedValue.length > 0) {
    let encodedChunkHead = encodedValue.slice(0, MAX_CHUNK_SIZE)
    const lastEscapePos = encodedChunkHead.lastIndexOf('%')
    if (lastEscapePos > MAX_CHUNK_SIZE - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos)
    }
    let valueHead = ''
    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead)
        break
      } catch (e) {
        if (e instanceof URIError && encodedChunkHead.at(-3) === '%' && encodedChunkHead.length > 3) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3)
        } else throw e
      }
    }
    chunks.push(valueHead)
    encodedValue = encodedValue.slice(encodedChunkHead.length)
  }
  return chunks.map((v, i) => ({ name: `${key}.${i}`, value: v }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, refresh_token, expires_at, expires_in } = body as {
      access_token: string
      refresh_token: string
      expires_at?: number
      expires_in?: number
    }

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
    }

    const [, b64Segment] = access_token.split('.')
    if (!b64Segment) {
      return NextResponse.json({ error: 'Malformed access_token' }, { status: 400 })
    }

    const payloadJson = Buffer.from(
      b64Segment.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8')
    const payload = JSON.parse(payloadJson)

    const resolvedExpiresIn = expires_in ?? 3600
    const resolvedExpiresAt = expires_at ?? Math.floor(Date.now() / 1000) + resolvedExpiresIn

    const session = {
      access_token,
      token_type: 'bearer',
      expires_in: resolvedExpiresIn,
      expires_at: resolvedExpiresAt,
      refresh_token,
      user: {
        id: payload.sub as string,
        aud: (payload.aud as string) ?? 'authenticated',
        role: (payload.role as string) ?? 'authenticated',
        email: (payload.email as string) ?? '',
        email_confirmed_at: (payload.email_confirmed_at as string) ?? new Date().toISOString(),
        phone: (payload.phone as string) ?? '',
        confirmed_at: (payload.confirmed_at as string) ?? new Date().toISOString(),
        last_sign_in_at: (payload.last_sign_in_at as string) ?? new Date().toISOString(),
        app_metadata: (payload.app_metadata as object) ?? {},
        user_metadata: (payload.user_metadata as object) ?? {},
        identities: (payload.identities as unknown[]) ?? [],
        created_at: (payload.created_at as string) ?? new Date().toISOString(),
        updated_at: (payload.updated_at as string) ?? new Date().toISOString(),
        is_anonymous: false,
      },
    }

    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    const cookieExpires = new Date(resolvedExpiresAt * 1000)
    const cookieStore = cookies()
    const chunks = createChunks(cookieName, JSON.stringify(session))

    for (const { name, value } of chunks) {
      cookieStore.set(name, value, {
        path: '/',
        expires: cookieExpires,
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      })
    }

    // Clean up stale chunks from a previous longer session
    for (let i = chunks.length; i < 10; i++) {
      const staleName = chunks.length === 1 ? `${cookieName}.${i}` : `${cookieName}.${i}`
      if (!request.cookies.get(staleName)) break
      cookieStore.set(staleName, '', { path: '/', maxAge: 0 })
    }

    // Determine redirect destination
    const userEmail = ((payload.email as string) ?? '').toLowerCase()
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').toLowerCase()

    let destination = '/auth/onboarding'

    if (userEmail === adminEmail) {
      destination = '/admin'
    } else {
      // Determine the user's app role. Prefer the users table (canonical),
      // fall back to the signup metadata stored in the JWT.
      let role: string | undefined
      try {
        const userRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=role&id=eq.${payload.sub}&limit=1`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${access_token}`,
              Accept: 'application/json',
            },
          }
        )
        const rows = await userRes.json()
        if (Array.isArray(rows) && typeof rows[0]?.role === 'string') {
          role = rows[0].role as string
        }
      } catch {
        // ignore — fall back to metadata
      }
      if (!role) {
        const metadata = (payload.user_metadata as Record<string, unknown>) ?? {}
        if (typeof metadata.role === 'string') role = metadata.role
      }

      if (role === 'flipper') {
        // Check whether the flipper has completed onboarding
        destination = '/auth/flipper-onboarding'
        try {
          const profileRes = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/flipper_profiles?select=onboarding_complete&user_id=eq.${payload.sub}&limit=1`,
            {
              headers: {
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                Authorization: `Bearer ${access_token}`,
                Accept: 'application/json',
              },
            }
          )
          const profiles = await profileRes.json()
          if (Array.isArray(profiles) && profiles[0]?.onboarding_complete === true) {
            destination = '/flipper/dashboard'
          }
        } catch {
          // safe fallback — stay on /auth/flipper-onboarding
        }
      } else {
        // worker (default) — check if worker has already completed onboarding
        try {
          const profileRes = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/worker_profiles?select=onboarding_complete&user_id=eq.${payload.sub}&limit=1`,
            {
              headers: {
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                Authorization: `Bearer ${access_token}`,
                Accept: 'application/json',
              },
            }
          )
          const profiles = await profileRes.json()
          if (Array.isArray(profiles) && profiles[0]?.onboarding_complete === true) {
            destination = '/gigs'
          }
        } catch {
          // If the check fails, default to onboarding — safe fallback
        }
      }
    }

    return NextResponse.json({ destination })
  } catch (err) {
    console.error('[set-session] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
