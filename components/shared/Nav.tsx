'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Armchair, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

interface NavProps {
  role: 'worker' | 'admin' | 'flipper'
  userName?: string
}

const workerLinks = [
  { href: '/gigs', label: 'Browse Gigs' },
  { href: '/my-gigs', label: 'My Gigs' },
  { href: '/my-gigs/payouts', label: 'Payouts' },
]

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/gigs', label: 'Gigs' },
  { href: '/admin/payouts', label: 'Payouts' },
]

const flipperLinks = [
  { href: '/flipper/dashboard', label: 'Dashboard' },
  { href: '/flipper/post-gig', label: 'Post a Gig' },
]

export default function Nav({ role, userName }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  const links =
    role === 'admin' ? adminLinks :
    role === 'flipper' ? flipperLinks :
    workerLinks

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href={role === 'admin' ? '/admin' : role === 'flipper' ? '/flipper/dashboard' : '/gigs'}
          className="flex items-center gap-2 font-serif text-xl text-foreground hover:text-accent transition-colors"
        >
          <Armchair className="w-5 h-5 text-accent" strokeWidth={1.5} />
          FlipWork
          {role === 'admin' && (
            <span className="text-xs font-mono font-medium text-muted-foreground ml-1">admin</span>
          )}
          {role === 'flipper' && (
            <span className="text-xs font-mono font-medium text-muted-foreground ml-1">flipper</span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm transition-colors',
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden sm:flex items-center gap-3">
          {userName && (
            <span className="text-sm text-muted-foreground">{userName}</span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="sm:hidden p-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-card px-4 py-3 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'block px-3 py-2 rounded-md text-sm transition-colors',
                pathname === link.href || pathname.startsWith(link.href + '/')
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border mt-2">
            {userName && (
              <p className="px-3 py-1 text-xs text-muted-foreground">{userName}</p>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
