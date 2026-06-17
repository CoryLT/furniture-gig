'use client'

import { useEffect, useRef, useState } from 'react'
import { Share2, Copy, Check, Mail, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Share button with a small popover menu.
 *
 * What it offers (in priority order):
 *  - Native share sheet (mobile mostly — iOS/Android/Chrome)
 *  - Copy link
 *  - Email
 *  - Text message (sms: link)
 *
 * The native share button only shows if the browser actually supports
 * `navigator.share`. On desktop, that's usually false, so users see
 * Copy / Email / Text instead — which is exactly what we want for
 * "paste into an email or text" workflows.
 *
 * The component takes the absolute URL and a short title. It does all
 * the FlipWork-branded text wrapping internally so we have one place
 * to tweak the share copy.
 */
interface ShareButtonProps {
  /** Absolute URL to share. Must include the protocol, e.g. https://... */
  url: string
  /** Short label, e.g. "Vintage walnut dresser" or "Sand and repaint vintage dresser" */
  title: string
  /**
   * Which kind of thing is being shared. Used to tune the prefilled
   * subject and body. Pick the closest match.
   */
  kind: 'listing' | 'gig'
  /** Optional className for the trigger button (size, alignment, etc.) */
  className?: string
  /** If true, just shows the icon — no "Share" label. Defaults to false. */
  iconOnly?: boolean
  /**
   * Which side the popover menu lines up with. Use 'left' when the button
   * sits near the LEFT edge of the screen, otherwise the menu can run off
   * the left side. Defaults to 'right'.
   */
  align?: 'left' | 'right'
}

export default function ShareButton({
  url,
  title,
  kind,
  className,
  iconOnly = false,
  align = 'right',
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Detect navigator.share support on mount (it's only available in
  // browser, never on the server, so we check after hydration).
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true)
    }
  }, [])

  // Close the popover when clicking outside, or hitting Escape.
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Branded share copy — keep both subject + body sounding human and
  // not spammy. We deliberately don't include the title in the body
  // because the link preview will usually surface it anyway, and
  // duplicating it makes texts look bot-generated.
  const noun = kind === 'gig' ? 'gig' : 'listing'
  const subject =
    kind === 'gig'
      ? `Check out this gig on FlipWork: ${title}`
      : `Check out this listing on FlipWork: ${title}`
  const body =
    kind === 'gig'
      ? `I thought you might be interested in this gig on FlipWork:\n\n${title}\n${url}`
      : `I thought you might be interested in this listing on FlipWork:\n\n${title}\n${url}`
  // For native share + SMS we want something more compact.
  const shortBody =
    kind === 'gig'
      ? `Check out this gig on FlipWork: ${url}`
      : `Check out this listing on FlipWork: ${url}`

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: subject,
        text: shortBody,
        url,
      })
      setOpen(false)
    } catch (err) {
      // User cancelled the share sheet — that's fine, do nothing.
      // (The Web Share API throws AbortError on cancel.)
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('[ShareButton] native share failed:', err)
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      // Show the "Copied!" state for ~1.5s then revert.
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.warn('[ShareButton] copy failed:', err)
      // Last-resort fallback: show a prompt the user can copy from.
      // Rare in modern browsers but possible on http (non-https) origins.
      window.prompt(`Copy the ${noun} link:`, url)
    }
  }

  function handleEmail() {
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = href
    setOpen(false)
  }

  function handleSms() {
    // The SMS deep link works on mobile. On desktop nothing happens
    // (or the OS asks how to handle it). We still show the option
    // because users on phones want it badly.
    const href = `sms:?&body=${encodeURIComponent(shortBody)}`
    window.location.href = href
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Share this ${noun}`}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
          'border border-border bg-card text-foreground hover:bg-muted transition-colors',
          className,
        )}
      >
        <Share2 className="w-4 h-4" />
        {!iconOnly && <span>Share</span>}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          className={cn(
            'absolute mt-2 w-56 max-w-[calc(100vw-1.5rem)] z-50 rounded-md border border-border bg-card shadow-lg overflow-hidden',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {canNativeShare && (
            <button
              type="button"
              role="menuitem"
              onClick={handleNativeShare}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
              <span>Share via…</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
            <span>{copied ? 'Copied!' : 'Copy link'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleEmail}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>Email</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleSms}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
          >
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span>Text message</span>
          </button>
        </div>
      )}
    </div>
  )
}
