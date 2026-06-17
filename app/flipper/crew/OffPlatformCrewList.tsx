'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Star, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react'

export type OffRow = {
  id: string
  name: string
  jobs: number
  paid: number
  rating: number | null
  notes: string
  wouldRehire: boolean | null
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

export default function OffPlatformCrewList({ crew }: { crew: OffRow[] }) {
  return (
    <div className="space-y-4">
      {crew.map((c) => (
        <OffCard key={c.id} row={c} />
      ))}
    </div>
  )
}

function OffCard({ row }: { row: OffRow }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(row.name)
  const [rating, setRating] = useState<number | null>(row.rating)
  const [notes, setNotes] = useState(row.notes)
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(row.wouldRehire)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)

  async function remove() {
    if (
      !window.confirm(
        `Remove "${row.name}" from your crew? This deletes this off-platform entry. ` +
          `(Use this if they're a duplicate of someone already on your crew.)`
      )
    )
      return
    setRemoving(true)
    setError('')
    const { error: err } = await supabase.from('crew_members').delete().eq('id', row.id)
    if (err) {
      setRemoving(false)
      setError('Could not remove. Try again.')
      return
    }
    router.refresh()
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    const cleanName = name.trim() || row.name
    const { error: err } = await (supabase.from('crew_members') as any)
      .update({
        worker_name: cleanName,
        rating,
        notes,
        would_rehire: wouldRehire,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
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
        <Link
          href={`/flipper/crew/${row.id}`}
          className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold shrink-0 hover:bg-accent/20"
          aria-label={`View ${row.name}`}
        >
          {initials(name || row.name)}
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Worker name"
            className="w-full font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none pb-0.5"
          />
          <p className="text-sm text-muted-foreground mt-0.5">
            Off-platform · {row.jobs} job{row.jobs === 1 ? '' : 's'} · {formatCurrency(row.paid)} paid
            {' · '}
            <Link href={`/flipper/crew/${row.id}`} className="text-accent hover:underline">
              View page
            </Link>
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
                  rating && n <= rating ? 'fill-accent text-accent' : 'text-muted-foreground/40'
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
          placeholder="Pays cash same day. Great with hauling. Reach by text only."
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
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 ml-auto disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </div>
  )
}
