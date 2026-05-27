'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Armchair } from 'lucide-react'

// Default role for new users. They can do both worker and flipper things
// in the app — we just need a value in the DB column for now.
const DEFAULT_ROLE = 'worker' as const

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // If they came here from a specific page (e.g. /marketplace/<slug>), carry
  // it through signup → onboarding → agreements so they end up back where
  // they started. Only honor safe internal paths (no /auth, no /admin).
  const rawNext = searchParams.get('next') ?? ''
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('/auth') && !rawNext.startsWith('/admin')
      ? rawNext
      : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const supabase = createClient()

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    // Forward next= through Google so /auth/finishing can pick it up
    const finishingUrl = new URL(`${window.location.origin}/auth/finishing`)
    if (safeNext) finishingUrl.searchParams.set('next', safeNext)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: finishingUrl.toString(),
        queryParams: { prompt: 'select_account' },
        data: { role: DEFAULT_ROLE },
      },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: DEFAULT_ROLE },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Everyone lands on the basic onboarding (name, phone, location).
    // Forward ?next= so the user lands back where they started post-agreements.
    const onboardingHref = safeNext
      ? `/auth/onboarding?next=${encodeURIComponent(safeNext)}`
      : '/auth/onboarding'
    router.push(onboardingHref)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 font-serif text-2xl text-foreground">
            <Armchair className="w-6 h-6 text-accent" strokeWidth={1.5} />
            FlipWork
          </Link>
          <p className="text-sm text-muted-foreground">
            Create your account
          </p>
          <p className="text-xs text-muted-foreground">
            Find gigs to work or post your own — both with one account.
          </p>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              loading={googleLoading}
              onClick={handleGoogleSignup}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs text-muted-foreground">
                <span className="bg-card px-2">or sign up with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="field-label">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="field-input" placeholder="you@example.com" required autoComplete="email" />
              </div>
              <div>
                <label htmlFor="password" className="field-label">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="field-input" placeholder="Min. 8 characters" required autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="confirm" className="field-label">Confirm password</label>
                <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="field-input" placeholder="Repeat your password" required autoComplete="new-password" />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" variant="accent" className="w-full" loading={loading}>
                Create account
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href={
              safeNext
                ? `/auth/login?next=${encodeURIComponent(safeNext)}`
                : '/auth/login'
            }
            className="text-accent hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
