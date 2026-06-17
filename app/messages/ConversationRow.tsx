'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { User, MoreVertical, Archive, ArchiveRestore, Trash2 } from 'lucide-react'

interface Props {
  conversationId: string
  conversationKind: 'gig' | 'listing' | 'user'
  href: string
  name: string
  avatarUrl: string | null
  contextLabel: string
  contextTitle: string
  preview: string
  when: string
  unread: number
  isArchived: boolean
  view: 'inbox' | 'archived'
}

export default function ConversationRow({
  conversationId,
  conversationKind,
  href,
  name,
  avatarUrl,
  contextLabel,
  contextTitle,
  preview,
  when,
  unread,
  isArchived,
}: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)

  function toggleMenu() {
    if (!menuOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      // Menu is roughly 130px tall; flip up if not enough room below.
      setOpenUp(spaceBelow < 160)
    }
    setMenuOpen((o) => !o)
  }

  async function doAction(action: 'archive' | 'unarchive' | 'delete') {
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/conversations/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationKind, conversationId, action }),
      })
      if (res.ok) {
        setMenuOpen(false)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setErr(data?.error || 'Action failed')
      }
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  const initials =
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || ''

  return (
    <div className="relative flex items-center gap-3 p-4 hover:bg-muted transition-colors">
      <Link href={href} className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarUrl ? (
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-muted">
              <Image src={avatarUrl} alt={name} fill sizes="44px" className="object-cover" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-medium">
              {initials || <User className="w-5 h-5" />}
            </div>
          )}
        </div>

        {/* Middle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className={`truncate ${unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                {name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {contextTitle ? `${contextLabel}: ${contextTitle}` : contextLabel}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`text-xs ${unread > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                {when}
              </span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
          </div>
          <p className={`text-sm truncate mt-1 ${unread > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {preview}
          </p>
        </div>
      </Link>

      {/* Actions menu */}
      <div className="relative flex-shrink-0">
        <button
          ref={btnRef}
          type="button"
          onClick={toggleMenu}
          disabled={busy}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Conversation options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <>
            {/* Backdrop to close on outside click */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className={`absolute right-0 z-20 w-44 bg-card border border-border rounded-lg shadow-lg overflow-hidden py-1 ${
                openUp ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              {isArchived ? (
                <button
                  type="button"
                  onClick={() => doAction('unarchive')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  Move to inbox
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => doAction('archive')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted text-left"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              )}
              <button
                type="button"
                onClick={() => doAction('delete')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              {err && (
                <p className="px-3 py-2 text-xs text-red-600 border-t border-border">
                  {err}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
