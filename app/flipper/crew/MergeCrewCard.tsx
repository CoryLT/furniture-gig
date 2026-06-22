'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'

export default function MergeCrewCard({
  fromId,
  fromName,
  targets,
}: {
  fromId: string
  fromName: string
  targets: { id: string; label: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function merge() {
    if (!target) return
    const label = targets.find((t) => t.id === target)?.label || 'that person'
    const ok = window.confirm(
      `Combine "${fromName}" into "${label}"?\n\nEvery payment for ${fromName} moves over to ${label}, and the ${fromName} card goes away. This can't be undone.`
    )
    if (!ok) return
    setErr('')
    setBusy(true)
    const { error } = await supabase.rpc('merge_crew_members', {
      p_from: fromId,
      p_to: target,
    })
    setBusy(false)
    if (error) {
      setErr('Could not combine them. Did the SQL update get run? Try again.')
      return
    }
    // The current person no longer exists — go back to the list.
    router.push('/flipper/crew')
    router.refresh()
  }

  if (targets.length === 0) return null

  return (
    <div className="card card-body space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Users className="w-4 h-4" />
          Same person as someone else?
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Combine duplicates</p>
          <p className="text-xs text-muted-foreground">
            Pick who <span className="font-medium">{fromName}</span> really is. All of{' '}
            {fromName}&apos;s payments move onto that person, and this card goes away. The kept
            person&apos;s rating and notes stay — {fromName}&apos;s only fill in any blanks.
          </p>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">Choose the person to keep…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy || !target}
              onClick={merge}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? 'Combining…' : 'Combine'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setTarget('')
                setErr('')
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
