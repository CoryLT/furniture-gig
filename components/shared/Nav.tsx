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
  { href: '/messages', label: 'Messages' },
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
  const [unreadMessages, setUnreadMessages] = useState(0)
  const currentUserIdRef = useRef<string | null>(null)

  const links = role === 'admin' ? adminLinks : userLinks

  // --- Unread messages: initial fetch + realtime subscription ---
  useEffect(() => {
    if (role === 'admin') return // admins don't use the inbox

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadAndSubscribe() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      currentUserIdRef.current = user.id

      // 1) Initial unread count.
      // Find conversations where I'm a participant, then count unread received msgs.
      const { data: convs } = await supabase
        .from('gig_conversations')
        .select('id, flipper_user_id, worker_user_id')
        .or(`flipper_user_id.eq.${user.id},worker_user_id.eq.${user.id}`)

      const convIds = (convs ?? []).map((c: { id: string }) => c.id)

      let initialCount = 0
      if (convIds.length > 0) {
        const { count } = await supabase
          .from('gig_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .neq('sender_user_id', user.id)
          .is('read_at', null)
        initialCount = count ?? 0
      }
      if (!cancelled) setUnreadMessages(initialCount)

      // 2) Subscribe to NEW messages and read-receipt updates across the whole
      //    gig_messages table — RLS will already restrict to messages we can see.
      channel = supabase.channel(`nav-unread:${user.id}`)

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gig_messages' },
        (payload) => {
          const m = payload.new as {
            sender_user_id: string
            read_at: string | null
          }
          // Only count messages sent BY someone else and not yet read
          if (
            m.sender_user_id !== currentUserIdRef.current &&
            m.read_at === null
          ) {
            setUnreadMessages((n) => n + 1)
          }
        }
      )

      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'gig_messages' },
        (payload) => {
          const before = payload.old as {
            sender_user_id?: string
            read_at?: string | null
          }
          const after = payload.new as {
            sender_user_id?: string
            read_at?: string | null
          }
          // Catch "marked read" transitions on messages where I was the recipient
          if (
            after.sender_user_id !== currentUserIdRef.current &&
            before.read_at === null &&
            after.read_at !== null
          ) {
            setUnreadMessages((n) => Math.max(0, n - 1))
          }
        }
      )

      channel.subscribe()
    }

    loadAndSubscribe()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  // When the user navigates to /messages or into a conversation, refresh the
  // unread count once the page settles — read_at updates may be in flight.
  useEffect(() => {
    if (role === 'admin') return
    if (!pathname?.startsWith('/messages')) return
    if (!currentUserIdRef.current) return
    const userId = currentUserIdRef.current

    const t = setTimeout(async () => {
      const { data: convs } = await supabase
        .from('gig_conversations')
        .select('id')
        .or(`flipper_user_id.eq.${userId},worker_user_id.eq.${userId}`)
      const convIds = (convs ?? []).map((c: { id: string }) => c.id)
      if (convIds.length === 0) {
        setUnreadMessages(0)
        return
      }
      const { count } = await supabase
        .from('gig_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_user_id', userId)
        .is('read_at', null)
      setUnreadMessages(count ?? 0)
    }, 1200)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, role])

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
              className={`text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                pathname === link.href
                  ? 'text-accent'
                  : 'text-foreground hover:text-accent'
              }`}
            >
              {link.label}
              {link.href === '/messages' && unreadMessages > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
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
                className={`py-2 text-sm font-medium inline-flex items-center gap-2 ${
                  pathname === link.href ? 'text-accent' : 'text-foreground'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
                {link.href === '/messages' && unreadMessages > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
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