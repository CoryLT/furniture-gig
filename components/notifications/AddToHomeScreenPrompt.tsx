'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'

// Per-device flag: install state is per-device, so a per-device dismiss fits.
const DISMISS_KEY = 'fw_a2hs_dismissed'

export default function AddToHomeScreenPrompt() {
  const [show, setShow] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const ua = navigator.userAgent || ''
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (isStandalone) return // already installed — nothing to show

    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {}
    if (dismissed) return

    const isIos = /iphone|ipad|ipod/i.test(ua)
    const isAndroid = /android/i.test(ua)
    setPlatform(isIos ? 'ios' : isAndroid ? 'android' : 'other')

    // Android/Chrome can offer a real one-tap install button.
    const onBIP = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    setShow(true)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
    setShow(false)
  }

  async function androidInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } catch {}
    setDeferredPrompt(null)
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="relative rounded-lg border border-accent/30 bg-accent/5 p-4 pr-9">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Add FlipWork to your phone
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Get a real app icon on your home screen — and it&apos;s the first
            step to getting buzzed about new messages.
          </p>

          {platform === 'ios' && (
            <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>
                In Safari, tap the Share button at the bottom (the square with an
                arrow pointing up).
              </li>
              <li>Scroll down and tap &ldquo;Add to Home Screen.&rdquo;</li>
              <li>Tap &ldquo;Add,&rdquo; then open FlipWork from the new icon.</li>
            </ol>
          )}

          {platform === 'android' && deferredPrompt && (
            <button
              onClick={androidInstall}
              className="mt-2 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              Install FlipWork
            </button>
          )}

          {platform === 'android' && !deferredPrompt && (
            <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>Tap the menu (⋮) in the top corner of Chrome.</li>
              <li>Tap &ldquo;Add to Home screen&rdquo; (or &ldquo;Install app&rdquo;).</li>
              <li>Confirm, then open FlipWork from the new icon.</li>
            </ol>
          )}

          {platform === 'other' && (
            <p className="text-sm text-muted-foreground mt-2">
              In your browser&apos;s menu, choose &ldquo;Install&rdquo; or
              &ldquo;Add to Home Screen.&rdquo;
            </p>
          )}

          <button
            onClick={dismiss}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
