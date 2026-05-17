'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Armchair, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface NavProps {
  role: 'worker' | 'admin' | 'flipper'
  userName?: string
  userUsername?: string
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

export default function Nav({ role, userName, userUsername }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const links = role === 'worker' ? workerLinks : role === 'admin' ? adminLinks : flipperLinks

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getPublicProfileUrl = () => {
    if (role === 'worker' && userUsername) {
      return `/workers/${userUsername}`
    }
    if (role === 'flipper' && userUsername) {
      return `/flippers/${userUsername}`
    }
    // If no username, don't render the link at all
    return null
  }

  return (
    <nav className="border-b border-stone-200 bg-white sticky top-0 z-40">
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

        {/* Right side - Hamburger menu */}
        <div className="flex items-center gap-4">
          {/* Desktop hamburger dropdown */}
          <div className="hidden md:block relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-600"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-50">
                {getPublicProfileUrl() && (
                  <Link
                    href={getPublicProfileUrl()!}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-stone-50 hover:text-accent transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    View Profile
                  </Link>
                )}
                <Link
                  href="/account"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-stone-50 hover:text-accent transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  Account Settings
                </Link>
                <Link
                  href="/support"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-stone-50 hover:text-accent transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  Support
                </Link>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    handleLogout()
                    setDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-stone-50 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

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
            <hr className="my-2" />
            {getPublicProfileUrl() && (
              <Link
                href={getPublicProfileUrl()!}
                className="block py-2 text-sm font-medium text-foreground"
                onClick={() => setMenuOpen(false)}
              >
                View Profile
              </Link>
            )}
            <Link
              href="/account"
              className="block py-2 text-sm font-medium text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              Account Settings
            </Link>
            <Link
              href="/support"
              className="block py-2 text-sm font-medium text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              Support
            </Link>
            <hr className="my-2" />
            <button
              onClick={() => {
                handleLogout()
                setMenuOpen(false)
              }}
              className="w-full text-left py-2 text-sm font-medium text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
