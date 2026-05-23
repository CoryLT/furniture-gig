'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Armchair, Menu } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface NavProps {
  role: 'worker' | 'admin' | 'flipper'
  userName?: string
  userUsername?: string
}

const userLinks = [
  { href: '/home', label: 'Dashboard' },
  { href: '/gigs', label: 'Browse Gigs' },
  { href: '/my-gigs', label: 'My Gigs' },
  { href: '/flipper/post-gig', label: 'Post a Gig' },
  { href: '/flipper/dashboard', label: 'My Posted Gigs' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/marketplace/new', label: 'List an Item' },
  { href: '/marketplace/mine', label: 'My Listings' },
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const currentUserIdRef = useRef<string | null>(null)

  const links = role === 'admin' ? adminLinks : userLinks
  const logoHref = role === 'admin' ? '/admin' : '/home'

  useEffect(() => {
    if (role === 'admin') return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadAndSubscribe() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      currentUserIdRef.current = user.id

      // -------- Conversations from BOTH tables --------
      const { data: gigConvs } = await supabase
        .from('gig_conversations')
        .select('id, flipper_user_id, worker_user_id')
        .or(`flipper_user_id.eq.${user.id},worker_user_id.eq.${user.id}`)

      const { data: listingConvs } = await supabase
        .from('listing_conversations')
        .select('id, seller_user_id, buyer_user_id')
        .or(`seller_user_id.eq.${user.id},buyer_user_id.eq.${user.id}`)

      const gigConvIds = (gigConvs ?? []).map((c: { id: string }) => c.id)
      const listingConvIds = (listingConvs ?? []).map((c: { id: string }) => c.id)

      // -------- Initial unread counts from BOTH tables --------
      let initialCount = 0
      if (gigConvIds.length > 0) {
        const { count } = await supabase
          .from('gig_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', gigConvIds)
          .neq('sender_user_id', user.id)
          .is('read_at', null)
        initialCount += count ?? 0
      }
      if (listingConvIds.length > 0) {
        const { count } = await supabase
          .from('listing_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', listingConvIds)
          .neq('sender_user_id', user.id)
          .is('read_at', null)
        initialCount += count ?? 0
      }
      if (!cancelled) setUnreadMessages(initialCount)

      // -------- Realtime subscriptions to BOTH messages tables --------
      channel = supabase.channel(`nav-unread:${user.id}`)

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gig_messages' },
        (payload) => {
          const m = payload.new as {
            sender_user_id: string
            read_at: string | null
          }
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
          if (
            after.sender_user_id !== currentUserIdRef.current &&
            before.read_at === null &&
            after.read_at !== null
          ) {
            setUnreadMessages((n) => Math.max(0, n - 1))
          }
        }
      )

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'listing_messages' },
        (payload) => {
          const m = payload.new as {
            sender_user_id: string
            read_at: string | null
          }
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
        { event: 'UPDATE', schema: 'public', table: 'listing_messages' },
        (payload) => {
          const before = payload.old as {
            sender_user_id?: string
            read_at?: string | null
          }
          const after = payload.new as {
            sender_user_id?: string
            read_at?: string | null
          }
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

  useEffect(() => {
    if (role === 'admin') return
    if (!pathname?.startsWith('/messages')) return
    if (!currentUserIdRef.current) return
    const userId = currentUserIdRef.current

    const t = setTimeout(async () => {
      // Pull conversation IDs from BOTH tables
      const { data: gigConvs } = await supabase
        .from('gig_conversations')
        .select('id')
        .or(`flipper_user_id.eq.${userId},worker_user_id.eq.${userId}`)
      const { data: listingConvs } = await supabase
        .from('listing_conversations')
        .select('id')
        .or(`seller_user_id.eq.${userId},buyer_user_id.eq.${userId}`)

      const gigConvIds = (gigConvs ?? []).map((c: { id: string }) => c.id)
      const listingConvIds = (listingConvs ?? []).map((c: { id: string }) => c.id)

      let total = 0
      if (gigConvIds.length > 0) {
        const { count } = await supabase
          .from('gig_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', gigConvIds)
          .neq('sender_user_id', userId)
          .is('read_at', null)
        total += count ?? 0
      }
      if (listingConvIds.length > 0) {
        const { count } = await supabase
          .from('listing_messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', listingConvIds)
          .neq('sender_user_id', userId)
          .is('read_at', null)
        total += count ?? 0
      }
      setUnreadMessages(total)
    }, 1200)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, role])

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
        // No profile yet
      }
    }
    loadCurrentUser()
  }, [supabase, role])

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
    const username = userUsername || currentUserUsername
    if (username) {
      return `/u/${username}`
    }
    return '/profile'
  }

  return (
    <nav className="border-b border-stone-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={logoHref} className="flex items-center gap-2 font-serif text-xl font-bold text-foreground">
          <Armchair className="w-5 h-5" />
          FlipWork
        </Link>

        <div className="flex items-center gap-4">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="relative p-2 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-600"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-foreground" />
              {/* At-a-glance unread badge on the hamburger so it's still visible
                  when nav items are tucked inside */}
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-50">
                {/* Primary nav (now collapsed into here on every viewport) */}
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setDropdownOpen(false)}
                    className={`flex items-center justify-between gap-2 px-4 py-2 text-sm transition-colors ${
                      pathname === link.href
                        ? 'text-accent bg-stone-50'
                        : 'text-foreground hover:bg-stone-50 hover:text-accent'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.href === '/messages' && unreadMessages > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-none">
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                      </span>
                    )}
                  </Link>
                ))}
                <hr className="my-1" />
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
        </div>
      </div>

    </nav>
  )
}
