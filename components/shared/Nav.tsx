'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Armchair, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NavProps {
  role: 'worker' | 'admin' | 'flipper'
  userName?: string
}

const workerLinks = [
  { href: '/profile/worker', label: 'Profile' },
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

  const links = role === 'worker' ? workerLinks : role === 'admin' ? adminLinks : flipperLinks

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-bold text-foreground">
          <Armchair className="w-5 h-5" />
          FlipWork
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-accent'
                  : 'text-foreground hover:text-accent'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side - User info + Logout */}
        <div className="flex items-center gap-4">
          {userName && <span className="hidden md:inline text-sm text-muted-foreground">{userName}</span>}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Sign out</span>
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 hover:bg-stone-100 rounded-lg"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-stone-50">
          <div className="px-4 py-4 space-y-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block py-2 text-sm font-medium ${
                  pathname === link.href ? 'text-accent' : 'text-foreground'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {userName && <p className="text-xs text-muted-foreground py-2">Logged in as {userName}</p>}
          </div>
        </div>
      )}
    </nav>
  )
}