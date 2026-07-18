'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

// The "Danger zone" card at the bottom of /profile. Lets the user
// delete their own account without emailing support. Two-step
// confirmation: click the red button, then type the account email
// in a modal to confirm. Calls POST /api/account/delete.
//
// This card is intentionally scary-looking (red border, warning
// icon) so a mis-tap on a phone doesn't wipe someone out. The
// email-match on the modal is the real safety gate.
export default function DeleteAccountCard() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Load the current account email so we can show it in the modal
  // and check the typed value client-side before we even hit the
  // server (saves a round-trip on typos).
  useEffect(() => {
    let active = true
    async function loadEmail() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      setEmail(user?.email ?? '')
    }
    loadEmail()
    return () => {
      active = false
    }
  }, [supabase])

  const canDelete =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase() &&
    !!email

  async function handleDelete() {
    if (!canDelete || busy) return
    setBusy(true)
    setError('')

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.')
        setBusy(false)
        return
      }

      // Server already tried to sign us out — do it again from the
      // browser so the cookie is cleared here too, then hard-nav
      // home so no stale state hangs around.
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore — we're leaving anyway
      }
      window.location.href = '/'
    } catch (e: any) {
      setError(e?.message || 'Network error. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-destructive" />
        <div className="flex-1">
          <h2 className="text-2xl font-serif font-bold text-foreground">
            Delete my account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Removes your profile, photos, pieces, books, and settings from
            FlipWork. This can&rsquo;t be undone. Some records may be kept for
            up to 90 days in backups and longer where the law requires (like
            tax records). See our{' '}
            <a
              href="/privacy-policy"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>{' '}
            for details.
          </p>

          {!open ? (
            <button
              type="button"
              onClick={() => {
                setOpen(true)
                setError('')
                setConfirmEmail('')
              }}
              className="mt-5 inline-flex items-center rounded-lg bg-destructive px-5 py-2.5 font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive/60"
            >
              Delete my account
            </button>
          ) : (
            <div className="mt-5 rounded-md border border-destructive/40 bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                To confirm, type your email:{' '}
                <span className="font-mono text-foreground">{email}</span>
              </p>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
              />

              {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    setError('')
                    setConfirmEmail('')
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete || busy}
                  className="inline-flex items-center rounded-lg bg-destructive px-5 py-2.5 font-medium text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-destructive/60"
                >
                  {busy ? 'Deleting…' : 'Yes, delete my account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
