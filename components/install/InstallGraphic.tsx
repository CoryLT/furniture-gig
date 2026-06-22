'use client'

import { useEffect, useState } from 'react'
import { Share, Plus, Check } from 'lucide-react'

// Self-contained looping illustration of installing the PWA:
// 1) tap Share  ->  2) Add to Home Screen  ->  3) icon on the home screen.
// Pure CSS/JS, themed with the app's accent token.

const STEPS = ['Tap Share', 'Add to Home Screen', 'Open from your home screen']

export default function InstallGraphic() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 3), 1900)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes fwPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.18);opacity:.7} }
          @keyframes fwPop { 0%{transform:scale(.2);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
          .fw-pulse{ animation:fwPulse 1.1s ease-in-out infinite }
          .fw-pop{ animation:fwPop .5s ease-out both }
        `,
        }}
      />

      {/* Phone */}
      <div
        className="relative overflow-hidden rounded-[2rem] border-[6px] border-foreground/80 bg-background shadow-xl"
        style={{ width: 224, height: 440 }}
      >
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-20 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-foreground/80" />

        {/* Base app screen */}
        <div className="absolute inset-0 flex flex-col">
          <div className="px-4 pt-7 pb-3">
            <div className="font-serif text-lg text-foreground">FlipWork</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">Your flips, handled</div>
          </div>
          <div className="flex-1 space-y-2 px-4">
            <div className="h-14 rounded-lg border border-border bg-card" />
            <div className="h-14 rounded-lg border border-border bg-card" />
            <div className="h-14 rounded-lg border border-border bg-card" />
          </div>
          {/* Safari-ish bottom bar */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-muted-foreground">‹</span>
            <span className="text-muted-foreground">›</span>
            <span
              className={
                'inline-flex h-7 w-7 items-center justify-center rounded-md ' +
                (step === 0 ? 'fw-pulse' : '')
              }
              style={
                step === 0
                  ? { background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }
                  : { color: 'hsl(var(--muted-foreground))' }
              }
            >
              <Share className="h-4 w-4" />
            </span>
            <span className="text-muted-foreground">⌘</span>
            <span className="text-muted-foreground">⧉</span>
          </div>
        </div>

        {/* Step 2: share sheet */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t border-border bg-card p-3 transition-transform duration-500"
          style={{ transform: step === 1 ? 'translateY(0)' : 'translateY(110%)' }}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-muted-foreground">
              <span>Copy</span>
              <span>⧉</span>
            </div>
            <div
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium"
              style={{ background: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--foreground))' }}
            >
              <span>Add to Home Screen</span>
              <Plus className="h-4 w-4" style={{ color: 'hsl(var(--accent))' }} />
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-muted-foreground">
              <span>Add Bookmark</span>
              <span>★</span>
            </div>
          </div>
        </div>

        {/* Step 3: home screen with the app icon */}
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-start bg-background pt-10 transition-opacity duration-500"
          style={{ opacity: step === 2 ? 1 : 0, pointerEvents: 'none' }}
        >
          <div className="grid grid-cols-4 gap-3 px-5">
            <div className="h-11 w-11 rounded-2xl bg-muted" />
            <div className="h-11 w-11 rounded-2xl bg-muted" />
            {step === 2 ? (
              <div
                className="fw-pop flex h-11 w-11 items-center justify-center rounded-2xl font-serif text-lg text-white shadow-md"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--play-gold, 42 90% 52%)) 100%)',
                }}
              >
                F
              </div>
            ) : (
              <div className="h-11 w-11" />
            )}
            <div className="h-11 w-11 rounded-2xl bg-muted" />
            <div className="h-11 w-11 rounded-2xl bg-muted/60" />
            <div className="h-11 w-11 rounded-2xl bg-muted/60" />
          </div>
          <div
            className="mt-3 flex items-center gap-1 text-[11px] font-medium"
            style={{ color: 'hsl(var(--accent))' }}
          >
            <Check className="h-3.5 w-3.5" /> FlipWork installed
          </div>
        </div>
      </div>

      {/* Caption + step dots */}
      <div className="mt-4 text-center">
        <p className="text-sm font-medium text-foreground">
          {step + 1}. {STEPS[step]}
        </p>
        <div className="mt-2 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === step ? 18 : 6,
                background: i === step ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground) / 0.4)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
