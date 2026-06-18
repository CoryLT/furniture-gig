'use client'

import Link from 'next/link'
import { Armchair } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Minimal top bar shown on public pages (logged-out marketplace).
 * For logged-in users, the existing Nav component renders instead.
 */
export default function PublicTopBar({
  current,
}: {
  current?: 'marketplace' | null
}) {
  return (
    <header className="border-b border-border bg-card sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-serif text-xl">
          <Armchair className="w-5 h-5 text-accent" strokeWidth={1.5} />
          FlipWork
        </Link>
        <nav className="hidden sm:flex items-center gap-1 text-sm" />
        <div className="flex items-center gap-2">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button variant="accent" size="sm">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
