'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Armchair } from 'lucide-react'

export default function FinishingPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')
  // DEBUG: on-screen log so we can diagnose mobile auth without DevTools
  const [debugLines, setDebugLines] = useState<string[]>([])
  const debug = (msg: string) =>
    setDebugLines((prev) => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`])

  useEffect(() => {
    async function handleOAuthCallback() {
      try {
        debug('finishing page mounted')
        const hash = window.location.hash
        debug(`hash present: ${hash ? 'yes (length ' + hash.length + ')' : 'NO'}`)
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
        debug(`access_token: ${access_token ? 'yes' : 'NO'}`)
        debug(`refresh_token: ${refresh_token ? 'yes' : 'NO'}`)

        if (!access_token || !refresh_token) {
          setStatus('No tokens found — redirecting…')
          window.location.replace('/auth/login')
          return
        }

        // Forward ?next= from this URL through to set-session so the
        // server can pick the right destination (back to the original page
        // they were trying to view, falling back to /marketplace).
        const urlNext = new URLSearchParams(window.location.search).get('next')
        debug(`next param: ${urlNext ?? 'none'}`)

        debug('calling /api/auth/set-session…')
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
        debug(`set-session response: ${res.status} ${res.ok ? 'ok' : 'NOT ok'}`)

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
          console.error('[finishing] set-session failed:', error)
          debug(`set-session error body: ${error}`)
          setStatus('Sign-in failed — redirecting…')
          setTimeout(() => window.location.replace('/auth/login'), 5000)
          return
        }

        const { destination } = await res.json()
        const target = destination ?? '/auth/onboarding'
        debug(`destination: ${target}`)

        // IMPORTANT: give the browser time to commit the Set-Cookie header
        // from the fetch above before we navigate. Without this delay, the
        // middleware on the destination page fires before the auth cookie is
        // visible, and bounces the user back to the landing page — which is
        // why sign-in appeared to need two clicks.
        setStatus('Almost done…')
        debug('calling router.refresh()')
        router.refresh()
        debug('waiting 150ms for cookie commit')
        await new Promise((resolve) => setTimeout(resolve, 150))
        debug(`redirecting to ${target}`)
        window.location.replace(target)
        debug('after replace() — should never see this line')
      } catch (err) {
        console.error('[finishing] unexpected error:', err)
        debug(`CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`)
        setStatus('Something went wrong — see debug below.')
        // DEBUG: don't auto-redirect during diagnosis so the user can read
        // the debug log on screen
      }
    }

    handleOAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-start gap-4 bg-background p-4 pt-12">
      <Armchair className="w-8 h-8 text-accent animate-pulse" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">{status}</p>
      {/* DEBUG: on-screen log. Remove this block once the mobile OAuth bug
          is fixed. */}
      <div className="w-full max-w-md mt-8 p-3 rounded-md border border-border bg-muted/30 text-xs font-mono text-muted-foreground space-y-1 max-h-96 overflow-auto">
        <div className="font-semibold text-foreground">Debug log:</div>
        {debugLines.length === 0 ? (
          <div>(nothing yet)</div>
        ) : (
          debugLines.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  )
}