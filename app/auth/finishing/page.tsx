'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Armchair } from 'lucide-react'

export default function FinishingPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')
  // DEBUG: on-screen log so we can diagnose the OAuth regression
  const [debugLines, setDebugLines] = useState<string[]>([])
  const debug = (msg: string) =>
    setDebugLines((prev) => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`])

  useEffect(() => {
    async function handleOAuthCallback() {
      try {
        debug(`mounted on host=${window.location.host}`)
        debug(`pathname=${window.location.pathname}`)
        debug(`search=${window.location.search || '(none)'}`)
        const hash = window.location.hash
        debug(`hash present: ${hash ? 'yes (length ' + hash.length + ')' : 'NO'}`)
        if (!hash) {
          debug('NO HASH — would redirect to /auth/login, but pausing for diagnosis')
          setStatus('No tokens — see debug below')
          // DEBUG: don't redirect; let user read the log
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
        debug(`access_token: ${access_token ? 'yes (' + access_token.length + ' chars)' : 'NO'}`)
        debug(`refresh_token: ${refresh_token ? 'yes' : 'NO'}`)

        if (!access_token || !refresh_token) {
          debug('missing tokens — pausing for diagnosis')
          setStatus('Missing tokens — see debug below')
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
          debug(`set-session error: ${error}`)
          setStatus('Sign-in failed — see debug below')
          return
        }

        const { destination } = await res.json()
        const target = destination ?? '/auth/onboarding'
        debug(`destination: ${target}`)

        // Check what auth cookies the browser sees right now
        debug(`document.cookie length: ${document.cookie.length}`)
        const cookieNames = document.cookie
          .split(';')
          .map((c) => c.trim().split('=')[0])
          .filter((n) => n.includes('auth'))
        debug(`auth cookies visible: ${cookieNames.length > 0 ? cookieNames.join(', ') : 'NONE'}`)

        setStatus('Almost done…')
        debug('calling router.refresh()')
        router.refresh()
        debug('waiting 500ms')
        await new Promise((resolve) => setTimeout(resolve, 500))
        debug(`redirecting to ${target}`)
        // DEBUG: pause before redirect so the user can read the log
        setStatus('Pausing 8s so you can read the debug log…')
        await new Promise((resolve) => setTimeout(resolve, 8000))
        debug('navigating now')
        window.location.replace(target)
      } catch (err) {
        console.error('[finishing] unexpected error:', err)
        debug(`CAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`)
        setStatus('Something went wrong — see debug below')
      }
    }

    handleOAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-start gap-4 bg-background p-4 pt-12">
      <Armchair className="w-8 h-8 text-accent animate-pulse" strokeWidth={1.5} />
      <p className="text-muted-foreground text-sm">{status}</p>
      {/* DEBUG: on-screen log. Remove when OAuth bug is fixed. */}
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