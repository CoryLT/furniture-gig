'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode } from 'react'

interface Props {
  /**
   * The URL to navigate to. If it starts with '#' we just update the hash
   * on the current page and fire a hashchange event so listeners pick it
   * up immediately. Anything else is a normal navigation.
   */
  href: string
  /** Extra classes appended to the base card styles. */
  className?: string
  children: ReactNode
}

/**
 * Clickable wrapper for the dashboard hero stat tiles. Handles hash links
 * on the same page (which Next.js's <Link> can be flaky about) by updating
 * the hash directly and dispatching the 'hashchange' event so listening
 * client components react to the change. Also smooth-scrolls to the gig
 * list below so users see the filter took effect.
 */
export default function FilterTile({ href, className, children }: Props) {
  const router = useRouter()

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Same-page hash navigation: handle it ourselves so it always fires
    // the hashchange event AND scrolls to the list.
    if (href.startsWith('#')) {
      e.preventDefault()
      const newUrl =
        window.location.pathname + window.location.search + href
      history.pushState(null, '', newUrl)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      // Scroll to the gig list so the filter result is visible.
      const list = document.getElementById('your-gigs')
      if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    // Anything else: let Next.js handle the navigation normally
    // (we used a regular <a> so it'd already work, but we route through
    // the App Router to avoid a full page refresh).
    e.preventDefault()
    router.push(href)
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={
        'card card-body hover:shadow-md hover:border-foreground/20 transition-all cursor-pointer ' +
        (className ?? '')
      }
    >
      {children}
    </a>
  )
}
