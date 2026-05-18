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

// Unified nav: any non-admin user sees all of these
const userLinks = [
  { href: '/gigs', label: 'Browse Gigs' },
  { href: '/my-gigs', label: 'My Gigs' },
  { href: '/flipper/post-gig', label: 'Post a Gig' },
  { href: '/flipper/dashboard', label: 'My Posted Gigs' },
  { href: '/my-gigs/payouts', label: 'Payouts' },
]

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/gigs', label: 'Gigs' },
  { href: '/admin/payouts', label: 'Payouts' },
]

export default function Nav({ role, userName, userUsername }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(null)

  const links = role === 'admin' ? adminLinks : userLinks

  // Load current user's username on mount (fallback if not passed in as prop)
  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const tableName = role === 'flipper' ? 'flipper_profiles' : 'worker_profiles'
        const { data: profile } = await supabase
          .from(tableName)
          .select('username')
          .eq('user_id', user.id)
          .single<{ username: string | null }>()

        if (profile?.username) {
          setCurrentUserUsername(profile.username)
        }
      } catch {
        // No profile yet — that's fine, link will route to setup page
      }
    }
    loadCurrentUser()
  }, [supabase, role])



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
    // Use the passed-in userUsername, fallback to currentUserUsername
    const username = userUsername || currentUserUsername

    if (username) {
      return `/u/${username}`
    }
    return '/profile'
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
                    My Profile
                  </Link>
                )}
                <Link
                  href="/profile"
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
                My Profile
              </Link>
            )}
            <Link
              href="/profile"
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