'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react'

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
}: {
  operatorId: string
  crew: CrewRow[]
}) {
  return (
    <div className="space-y-4">
      {crew.map((c) => (
        <CrewCard key={c.workerId} operatorId={operatorId} row={c} />
      ))}
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

function CrewCard({ operatorId, row }: { operatorId: string; row: CrewRow }) {
  const router = useRouter()
  const supabase = createClient()
  const [rating, setRating] = useState<number | null>(row.rating)
  const [notes, setNotes] = useState(row.notes)
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(row.wouldRehire)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="card card-body space-y-4">
      {/* Identity + track record */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold shrink-0">
          {initials(row.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-foreground">{row.name}</p>
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

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button variant="accent" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
