'use client'

import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

/**
 * Fixed-position "back to top" button.
 *
 * Lives in the bottom-right corner of every page (it's mounted from
 * the root layout). The button is hidden when the user is near the
 * top of the page and fades in once they've scrolled down a bit.
 *
 * Click behavior is a smooth scroll to top. We use `behavior: 'smooth'`
 * which every modern browser supports — older browsers will just snap,
 * which is fine.
 *
 * Accessibility:
 *  - Keyboard-focusable (it's a real <button>)
 *  - `aria-label` describes the action
 *  - When hidden, we render nothing rather than hide with CSS so it
 *    isn't reachable by tab navigation when not visible
 */
export default function BackToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show the button once the user has scrolled this many pixels down.
    // 400 is roughly one phone screen — far enough that they'd want it,
    // not so far they wonder where it went.
    const SHOW_AFTER_PX = 400

    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX)
    }

    // Set initial state (in case the page loads scrolled down — e.g. an
    // anchor jump or browser back/forward restore)
    onScroll()

    // Passive listener — we never preventDefault, and this signals to
    // the browser that scroll handling can stay on the compositor for
    // smoother performance.
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleClick() {
    // `behavior: 'smooth'` works everywhere we care about. If the user
    // has "Reduce motion" enabled at the OS level, browsers respect it
    // and skip the animation automatically.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      title="Back to top"
      className="
        fixed bottom-6 right-6 z-40
        h-11 w-11 rounded-full
        bg-accent text-accent-foreground
        shadow-lg hover:shadow-xl
        flex items-center justify-center
        hover:scale-105 active:scale-95
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background
      "
    >
      <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
    </button>
  )
}
