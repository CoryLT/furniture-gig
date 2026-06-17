'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, X } from 'lucide-react'

// Public VAPID key (safe to ship). Matches lib/push.ts / env override.
const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BHTTN0akNAU3O04KaEdltM3UbSLgtmzu4wJl4zFhOKOPWhKthof9YiHDi2NsvuQ-q3nZxfmbSZS-LXNe3GZANM4'

type Status =
  | 'loading'
  | 'unsupported' // browser can't do push at all
  | 'ios-needs-install' // iPhone, but not opened from home-screen icon
  | 'off' // supported, not subscribed yet
  | 'on' // subscribed
  | 'blocked' // permission denied in OS/browser settings
  | 'working' // mid-action

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export default function EnableNotificationsButton({
  placement = 'dashboard',
}: {
  placement?: 'dashboard' | 'settings'
}) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Remember if the dashboard nudge was closed (settings always shows it).
  useEffect(() => {
    try {
      if (localStorage.getItem('fw_buzz_dismissed') === '1') setDismissed(true)
    } catch {}
  }, [])

  function dismiss() {
    try {
      localStorage.setItem('fw_buzz_dismissed', '1')
    } catch {}
    setDismissed(true)
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window

      const ua = navigator.userAgent || ''
      const isIos = /iphone|ipad|ipod/i.test(ua)
      const isStandalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true

      // iPhone only allows push when launched from the home-screen icon.
      if (isIos && !isStandalone) {
        if (!cancelled) setStatus('ios-needs-install')
        return
      }
      if (!supported) {
        if (!cancelled) setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('blocked')
        return
      }

      // Permission already granted → keep it working with zero taps:
      // re-register and re-save the subscription automatically on every open,
      // so it can never silently fall off the server.
      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.getRegistration()
          const existing = reg ? await reg.pushManager.getSubscription() : null
          if (existing) {
            saveSubscription(existing).catch(() => {})
            if (!cancelled) setStatus('on')
          } else {
            // Granted but no subscription yet — set one up silently.
            await subscribeNow()
            if (!cancelled) setStatus('on')
          }
        } catch {
          if (!cancelled) setStatus('off')
        }
        return
      }

      // Not decided yet → show the one-time "Turn on" prompt.
      if (!cancelled) setStatus('off')
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  // Best-effort: make sure the server has this device's subscription on file.
  async function saveSubscription(sub: PushSubscription): Promise<void> {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userAgent: navigator.userAgent,
      }),
    })
    if (!res.ok) {
      let detail = ''
      try {
        const j = await res.json()
        detail = j?.error || ''
      } catch {}
      throw new Error(detail || `couldn't save (status ${res.status})`)
    }
  }

  // Register the service worker, subscribe to push, and save it. Throws on failure.
  async function subscribeNow(): Promise<void> {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
    await saveSubscription(sub)
  }

  async function enable() {
    setError(null)
    setStatus('working')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      await subscribeNow()
      setStatus('on')
    } catch (e: any) {
      console.error('enable notifications failed', e)
      setError(`Couldn't turn on: ${e?.message || 'unknown error'}`)
      setStatus('off')
    }
  }

  async function sendTest() {
    setTestMsg('Sending…')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const j = await res.json()
      if (!j.configured) {
        setTestMsg(
          "The server isn't set up to send yet — the VAPID key is missing in Vercel."
        )
      } else if (!j.subs) {
        setTestMsg('No device is registered. Tap "Turn off", then "Turn on" again.')
      } else if (j.sent > 0) {
        setTestMsg('Sent! Watch for the buzz in a second.')
      } else {
        setTestMsg(
          "Tried to send, but it didn't go through. Tap Turn off, then Turn on again to refresh this device."
        )
      }
    } catch {
      setTestMsg('Test failed to run. Try again.')
    }
  }

  async function disable() {
    setError(null)
    setStatus('working')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('off')
    } catch (e) {
      console.error('disable notifications failed', e)
      setStatus('on')
    }
  }

  // ---- Render ----
  if (status === 'loading') return null
  // On the dashboard, respect a closed nudge (settings still shows everything).
  if (dismissed && placement === 'dashboard') return null

  const card =
    'rounded-lg border border-border bg-card px-4 py-3 text-sm flex items-center gap-3'

  if (status === 'unsupported') return null // quietly hide on browsers that can't

  if (status === 'ios-needs-install') {
    // The Add-to-Home-Screen guide covers this case, so don't duplicate it here.
    return null
  }

  if (status === 'blocked') {
    return (
      <div className={card}>
        <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">
          Notifications are blocked. Turn them on for FlipWork in your phone&apos;s
          Settings, then reload this page.
        </span>
      </div>
    )
  }

  if (status === 'on') {
    // On the dashboard we go quiet once it's working — the on/off and test
    // controls live in Account Settings instead, so the dashboard stays clean.
    if (placement === 'dashboard') return null
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-foreground">
            <BellRing className="w-5 h-5 text-accent shrink-0" />
            Notifications are on.
          </span>
          <button
            onClick={disable}
            className="text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
          >
            Turn off
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <button
            onClick={sendTest}
            className="bg-accent text-accent-foreground px-3 py-1.5 rounded-lg font-medium shrink-0"
          >
            Send a test buzz
          </button>
          {testMsg && <span className="text-muted-foreground">{testMsg}</span>}
        </div>
      </div>
    )
  }

  // status === 'off' or 'working'
  return (
    <div className={`${card} justify-between`}>
      <span className="flex items-center gap-2 text-foreground">
        <Bell className="w-5 h-5 text-accent shrink-0" />
        {error || 'Get a buzz when you have a new message.'}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={enable}
          disabled={status === 'working'}
          className="bg-accent text-accent-foreground px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
        >
          {status === 'working' ? 'Working…' : 'Turn on'}
        </button>
        {placement === 'dashboard' && (
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
