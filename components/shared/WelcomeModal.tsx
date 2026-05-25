'use client'

import { useState } from 'react'

// ============================================================
// WelcomeModal
// ============================================================
// One-time popup shown to brand-new users on first /home visit.
// On click, calls POST /api/welcome/dismiss to mark them as seen,
// then closes locally. Server-side render decides whether to
// mount this at all (only when dismissed_welcome_modal_at is null).
// ============================================================

export function WelcomeModal() {
  const [open, setOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleDismiss = async () => {
    setSubmitting(true)
    try {
      await fetch('/api/welcome/dismiss', { method: 'POST' })
    } catch {
      // If the API fails, still close the modal locally. Worst
      // case the user sees it once more next time.
    } finally {
      setOpen(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div className="card max-w-lg w-full p-6 sm:p-8 shadow-xl">
        <div className="space-y-5">
          <h2
            id="welcome-modal-title"
            className="font-serif text-2xl sm:text-3xl text-foreground"
          >
            Welcome to FlipWork! <span aria-hidden>🎉</span>
          </h2>

          <div className="space-y-4 text-foreground/90 leading-relaxed text-sm sm:text-base">
            <p>You&apos;re in. Seriously, thank you.</p>

            <p>
              Here&apos;s the deal. FlipWork is brand new. I built it because
              Facebook Marketplace and Craigslist are full of scams and
              sketchy meetups, and the furniture flipping world deserves a
              real home. A place to buy, sell, find help, and get paid
              without the headache.
            </p>

            <p>
              You&apos;re getting in early. The site&apos;s still filling up,
              but every listing is real, every gig is real, and every dollar
              paid is real. The more people who join, the more this thing
              kicks into gear.
            </p>

            <p>Let&apos;s build something good.</p>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cory-founder.jpg"
              alt="Cory, founder of FlipWork"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            <div>
              <p className="font-serif text-base text-foreground leading-tight">
                Cory
              </p>
              <p className="text-xs text-muted-foreground">
                Founder, FlipWork
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 disabled:opacity-60 transition"
            >
              {submitting ? 'Closing...' : "Let's go!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
