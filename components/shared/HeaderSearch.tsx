'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

export default function HeaderSearch() {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [q, setQ] = useState('')
  const mobileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus()
  }, [mobileOpen])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    setMobileOpen(false)
    router.push(`/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <>
      {/* Desktop: inline search bar */}
      <form
        onSubmit={submit}
        className="hidden md:flex items-center flex-1 max-w-md mx-4"
      >
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people, services, listings, gigs…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          />
        </div>
      </form>

      {/* Mobile: icon that expands into an overlay search bar */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden p-2 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-600"
        aria-label="Search"
      >
        <Search className="w-5 h-5 text-foreground" />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-2">
            <form onSubmit={submit} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search FlipWork…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </form>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
              aria-label="Close search"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
