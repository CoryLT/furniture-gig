'use client'

import { useEffect, useState } from 'react'
import { Armchair } from 'lucide-react'

export default function FinishingPage() {
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

        // Hand the tokens to the server so it can write a properly chunked
        // session cookie — bypasses the 4 KB browser cookie limit.
        const res = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token, expires_in, expires_at }),
        })

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
          console.error('[finishing] set-session failed:', error)
          setStatus('Sign-in failed — redirecting…')
          setTimeout(() => window.location.replace('/auth/login'), 1000)
          return
        }

        const { destination } = await res.json()
        window.location.replace(destination ?? '/auth/onboarding')
      } catch (err) {
        console.error('[finishing] unexpected error:', err)
        setStatus('Something went wrong — redirecting to login…')
        setTimeout(() => window.location.replace('/auth/login'), 1500)
      }
    }

    handleOAuthCallback()
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Armchair className="w-8 h-8 text-accent animate-pulse" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">{status}</p>
    </div>
  )
}
