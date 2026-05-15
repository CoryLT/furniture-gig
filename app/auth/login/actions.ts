'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').toLowerCase()
  const isAdmin = email.toLowerCase() === adminEmail

  // Honour the redirectTo param if it's a safe internal path
  const redirectTo = formData.get('redirectTo') as string | null
  const safeRedirect =
    redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('/auth')
      ? redirectTo
      : null

  if (isAdmin) {
    redirect(safeRedirect && safeRedirect.startsWith('/admin') ? safeRedirect : '/admin')
  } else {
    redirect(safeRedirect && !safeRedirect.startsWith('/admin') ? safeRedirect : '/gigs')
  }
}
