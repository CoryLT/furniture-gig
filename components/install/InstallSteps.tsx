'use client'

import { useEffect, useState } from 'react'
import { Apple, Smartphone, Monitor } from 'lucide-react'

export default function InstallSteps() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const [installed, setInstalled] = useState(false)
  const [deferred, setDeferred] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = navigator.userAgent || ''
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    setInstalled(!!standalone)
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'other')
    const onBIP = (e: any) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  async function install() {
    if (!deferred) return
    deferred.prompt()
    try {
      await deferred.userChoice
    } catch {}
    setDeferred(null)
  }

  const cardBase = 'rounded-xl border p-4'
  const active = 'border-accent/40 bg-accent/5'
  const dim = 'border-border'

  if (installed) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm text-foreground">
        You&apos;re already using the installed app — you&apos;re all set. 🎉
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {deferred && (
        <button
          onClick={install}
          className="w-full rounded-lg bg-accent px-5 py-3 text-center font-medium text-accent-foreground hover:bg-accent/90"
        >
          Install FlipWork now
        </button>
      )}

      {/* iPhone / iPad */}
      <div className={`${cardBase} ${platform === 'ios' ? active : dim}`}>
        <div className="mb-2 flex items-center gap-2">
          <Apple className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">iPhone &amp; iPad (Safari)</span>
          {platform === 'ios' && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              Your device
            </span>
          )}
        </div>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Tap the Share button at the bottom (a square with an up arrow).</li>
          <li>Scroll down and tap &ldquo;Add to Home Screen.&rdquo;</li>
          <li>Tap &ldquo;Add,&rdquo; then open FlipWork from the new icon.</li>
        </ol>
      </div>

      {/* Android */}
      <div className={`${cardBase} ${platform === 'android' ? active : dim}`}>
        <div className="mb-2 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">Android (Chrome)</span>
          {platform === 'android' && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              Your device
            </span>
          )}
        </div>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Tap the menu (⋮) in the top corner of Chrome.</li>
          <li>Tap &ldquo;Add to Home screen&rdquo; (or &ldquo;Install app&rdquo;).</li>
          <li>Confirm, then open FlipWork from the new icon.</li>
        </ol>
      </div>

      {/* Desktop */}
      <div className={`${cardBase} ${platform === 'other' ? active : dim}`}>
        <div className="mb-2 flex items-center gap-2">
          <Monitor className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">Computer (Chrome / Edge)</span>
          {platform === 'other' && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              Your device
            </span>
          )}
        </div>
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Click the install icon in the address bar (or the ⋮ menu).</li>
          <li>Choose &ldquo;Install&rdquo; or &ldquo;Add to Home Screen.&rdquo;</li>
          <li>FlipWork opens in its own window like a normal app.</li>
        </ol>
      </div>
    </div>
  )
}
