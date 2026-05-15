import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for an active Supabase session by reading the cookie directly.
  // This avoids any network call and cannot hang.
  const hasSession = request.cookies.getAll().some(
    (c) => c.name.includes('-auth-token') && c.value.length > 10
  )

  // Routes that require the user to be logged in
  const protectedPrefixes = [
    '/gigs',
    '/my-gigs',
    '/admin',
    '/flipper',
    '/auth/onboarding',
    '/auth/flipper-onboarding',
    '/auth/agreements',
  ]
  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (!hasSession && needsAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
