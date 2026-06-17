'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Star, ThumbsUp, ThumbsDown, Trash2, RotateCcw } from 'lucide-react'

type CrewRow = {
  workerId: string
  name: string
  username: string | null
  jobs: number
  completed: number
  paid: number
  rating: number | null
  notes: string
  wouldRehire: boolean | null
}

export default function CrewList({
  operatorId,
  crew,
  removed,
}: {
  operatorId: string
  crew: CrewRow[]
  removed: CrewRow[]
}) {
  return (
    <div className="space-y-6">
      {crew.length === 0 ? (
        <div className="card card-body text-center py-12">
          <p className="text-sm text-muted-foreground">
            Everyone has been removed from your list. Restore someone below to bring them back.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {crew.map((c) => (
            <CrewCard key={c.workerId} operatorId={operatorId} row={c} />
          ))}
        </div>
      )}

      {removed.length > 0 && (
        <RemovedSection operatorId={operatorId} removed={removed} />
      )}
    </div>
  )
}

function initials(name: string) {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

async function setHidden(operatorId: string, workerId: string, hidden: boolean) {
  const supabase = createClient()
  return (supabase.from('crew_members') as any).upsert(
    {
      operator_user_id: operatorId,
      worker_user_id: workerId,
      hidden,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'operator_user_id,worker_user_id' }
  )
}

function CrewCard({ operatorId, row }: { operatorId: string; row: CrewRow }) {
  const router = useRouter()
  const supabase = createClient()
  const [rating, setRating] = useState<number | null>(row.rating)
  const [notes, setNotes] = useState(row.notes)
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(row.wouldRehire)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    const { error: err } = await (supabase.from('crew_members') as any).upsert(
      {
        operator_user_id: operatorId,
        worker_user_id: row.workerId,
        rating,
        notes,
        would_rehire: wouldRehire,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'operator_user_id,worker_user_id' }
    )
    setSaving(false)
    if (err) {
      setError('Could not save. Try again.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  async function remove() {
    const ok = window.confirm(
      `Remove ${row.name} from your crew list?\n\nTheir work history is kept and you can restore them later.`
    )
    if (!ok) return
    setRemoving(true)
    setError('')
    const { error: err } = await setHidden(operatorId, row.workerId, true)
    setRemoving(false)
    if (err) {
      setError('Could not remove. Try again.')
      return
    }
    router.refresh()
  }

  return (
    <div className="card card-body space-y-4">
      {/* Identity + track record */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold shrink-0">
          {initials(row.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/flipper/crew/${row.workerId}`}
              className="font-semibold text-foreground hover:text-accent hover:underline"
            >
              {row.name}
            </Link>
            {row.username && (
              <Link
                href={`/u/${row.username}`}
                className="text-sm text-accent hover:underline"
              >
                @{row.username}
              </Link>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {row.jobs} job{row.jobs === 1 ? '' : 's'} · {row.completed} completed · $
            {row.paid.toFixed(2)} paid
          </p>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-24 shrink-0">Your rating</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              className="p-0.5"
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
            >
              <Star
                className={`w-6 h-6 ${
                  rating && n <= rating
                    ? 'fill-accent text-accent'
                    : 'text-muted-foreground/40'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Would rehire */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-24 shrink-0">Rehire?</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWouldRehire(wouldRehire === true ? null : true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              wouldRehire === true
                ? 'bg-accent text-accent-foreground border-accent'
                : 'border-border text-foreground hover:bg-muted'
            }`}
          >
            <ThumbsUp className="w-4 h-4" /> Yes
          </button>
          <button
            type="button"
            onClick={() => setWouldRehire(wouldRehire === false ? null : false)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              wouldRehire === false
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-foreground hover:bg-muted'
            }`}
          >
            <ThumbsDown className="w-4 h-4" /> No
          </button>
        </div>
      </div>

      {/* Private notes */}
      <div>
        <label className="text-sm text-muted-foreground">Private notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Great with dressers. Always on time. Slow to reply by text."
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p className="text-xs text-muted-foreground mt-1">Only you can see this.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="accent" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

function RemovedSection({
  operatorId,
  removed,
}: {
  operatorId: string
  removed: CrewRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function restore(workerId: string) {
    setBusyId(workerId)
    const { error: err } = await setHidden(operatorId, workerId, false)
    setBusyId(null)
    if (!err) router.refresh()
  }

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? 'Hide' : 'Show'} removed ({removed.length})
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {removed.map((c) => (
            <div key={c.workerId} className="card card-body flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                {initials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.jobs} job{c.jobs === 1 ? '' : 's'} · ${c.paid.toFixed(2)} paid
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(c.workerId)}
                disabled={busyId === c.workerId}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {busyId === c.workerId ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
