'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Armchair } from 'lucide-react'

export default function FinishingPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    async function handleOAuthCallback() {
      try {
        const hash = window.location.hash
        if (!hash) {
          window.location.replace('/auth/login')
          return
        }

        const params = new URLSearchParams(hash.substring(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const expires_in = parseInt(params.get('expires_in') || '3600', 10)
        const expires_at = parseInt(
          params.get('expires_at') || String(Math.floor(Date.now() / 1000) + expires_in),
          10
        )

        if (!access_token || !refresh_token) {
          setStatus('No tokens found — redirecting…')
          window.location.replace('/auth/login')
          return
        }

        // Forward ?next= from this URL through to set-session so the
        // server can pick the right destination (back to the original page
        // they were trying to view, falling back to /marketplace).
        const urlNext = new URLSearchParams(window.location.search).get('next')

        const res = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token,
            refresh_token,
            expires_in,
            expires_at,
            next: urlNext ?? undefined,
          }),
        })

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
          console.error('[finishing] set-session failed:', error)
          setStatus('Sign-in failed — redirecting…')
          setTimeout(() => window.location.replace('/auth/login'), 1000)
          return
        }

        const { destination } = await res.json()
        const target = destination ?? '/auth/onboarding'

        // IMPORTANT: give the browser time to commit the Set-Cookie header
        // from the fetch above before we navigate. Without this delay, the
        // middleware on the destination page fires before the auth cookie is
        // visible, and bounces the user back to the landing page. 500ms (was
        // 150ms originally) is safer on iOS Safari, which can be slow to
        // persist large chunked Supabase auth cookies.
        setStatus('Almost done…')
        router.refresh()
        await new Promise((resolve) => setTimeout(resolve, 500))
        window.location.replace(target)
      } catch (err) {
        console.error('[finishing] unexpected error:', err)
        setStatus('Something went wrong — redirecting to login…')
        setTimeout(() => window.location.replace('/auth/login'), 1500)
      }
    }

    handleOAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Armchair className="w-8 h-8 text-accent animate-pulse" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">{status}</p>
    </div>
  )
}