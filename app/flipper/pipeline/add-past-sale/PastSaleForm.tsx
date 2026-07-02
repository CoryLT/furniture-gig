'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Plus, CheckCircle2, ImagePlus, X } from 'lucide-react'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'

const money = (v: number) =>
  '$' +
  (Math.round(v * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function PastSaleForm({
  me,
  crew = [],
}: {
  me: string
  crew?: { id: string; label: string }[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [paid, setPaid] = useState('')
  const [soldFor, setSoldFor] = useState('')
  const [fixUp, setFixUp] = useState('')
  const [fixCrew, setFixCrew] = useState('')
  const [crewList, setCrewList] = useState(crew)
  const [addingPerson, setAddingPerson] = useState(false)
  const [newPerson, setNewPerson] = useState('')
  const [savingPerson, setSavingPerson] = useState(false)
  const [month, setMonth] = useState(() => {
    // Default to this month so a sale that just happened needs no date tap.
    // Change it only for something sold a while ago.
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }) // "YYYY-MM"
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [lastSaved, setLastSaved] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null) {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }
  function clearFile() {
    setFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Add a name-only crew member right here, then select them. Same find-or-create
  // by name the rest of the app uses, so we don't make duplicates.
  async function addPerson() {
    const name = newPerson.trim()
    if (!name) return
    setSavingPerson(true)
    try {
      const { data: existing } = await supabase
        .from('crew_members')
        .select('id')
        .eq('operator_user_id', me)
        .is('worker_user_id', null)
        .ilike('worker_name', name)
        .maybeSingle()
      let id = (existing as any)?.id as string | undefined
      if (!id) {
        const { data: created, error } = await (supabase.from('crew_members') as any)
          .insert({ operator_user_id: me, worker_name: name })
          .select('id')
          .single()
        if (error || !created) {
          setErr('Could not add that person. Try again.')
          setSavingPerson(false)
          return
        }
        id = created.id as string
      }
      // Show them in the dropdown (if not already there) and pick them.
      setCrewList((list) =>
        list.some((c) => c.id === id) ? list : [...list, { id: id as string, label: name }]
      )
      setFixCrew(id)
      setNewPerson('')
      setAddingPerson(false)
    } finally {
      setSavingPerson(false)
    }
  }

  // Uses the same moderated upload as the Pipeline. The piece must already
  // exist (the API sets its image_path), which it does by the time we call this.
  async function uploadPhoto(pieceId: string, f: File): Promise<string | null> {
    if (!isAcceptableImageFile(f)) return null
    let toSend = f
    try {
      toSend = await compressImageForUpload(f)
    } catch {
      /* fall back to original */
    }
    const fd = new FormData()
    fd.append('file', toSend)
    fd.append('pieceId', pieceId)
    try {
      const res = await fetch('/api/upload-piece-image', { method: 'POST', body: fd })
      const json = await res.json()
      return res.ok && json?.image?.file_path ? (json.image.file_path as string) : null
    } catch {
      return null
    }
  }

  async function save(addAnother: boolean) {
    setErr('')
    const sp = parseFloat(soldFor)
    const paidNum = parseFloat(paid) || 0
    if (!title.trim()) {
      setErr('Give the piece a name.')
      return
    }
    if (isNaN(sp) || sp <= 0) {
      setErr('Enter what it sold for.')
      return
    }
    if (!month) {
      setErr('Pick the month it sold.')
      return
    }

    // Quantity — create one sold piece per item, all at the same price.
    const n = Math.max(1, Math.min(100, parseInt(qty, 10) || 1))

    // Day doesn't matter — drop it mid-month so it sits cleanly in the period.
    const dateStr = `${month}-15`
    const soldIso = new Date(dateStr + 'T12:00:00').toISOString()
    setSaving(true)

    // 1) Create the pieces (one row per item), already marked sold.
    const baseTitle = title.trim()
    const rowsToInsert = Array.from({ length: n }, (_, i) => ({
      owner_user_id: me,
      stage: 'sold',
      title: n > 1 ? `${baseTitle} (${i + 1} of ${n})` : baseTitle,
      acquired_at: dateStr,
      sold_at: soldIso,
      sale_price: sp,
    }))
    const { data: created, error } = await (supabase.from('inventory_pieces') as any)
      .insert(rowsToInsert)
      .select('id')
    if (error || !created || created.length === 0) {
      setSaving(false)
      setErr('Could not save. Try again.')
      return
    }
    const ids = (created as any[]).map((r) => r.id as string)

    // Optional photo — upload once, then share the same image on the rest.
    let photoWarn = ''
    if (file) {
      const path = await uploadPhoto(ids[0], file)
      if (!path) {
        photoWarn = ' · photo didn’t upload (add it later from the Pipeline)'
      } else if (ids.length > 1) {
        await (supabase.from('inventory_pieces') as any)
          .update({ image_path: path })
          .in('id', ids.slice(1))
      }
    }

    // 2 + 3) Cost and sale income -> Books for each piece, dated to that month.
    const fixNum = parseFloat(fixUp) || 0
    let bookWarn = ''
    for (const id of ids) {
      if (paidNum > 0) {
        const { error: pe } = await supabase.rpc('set_piece_purchase', {
          p_piece_id: id,
          p_amount: paidNum,
          p_date: dateStr,
        })
        if (pe) bookWarn = ' · cost didn’t reach Books (did the SQL update get run?)'
      }
      // Optional labor cost — money you paid someone to fix it up. One expense
      // per piece, dated to the sale month, tagged to a crew member for 1099
      // tracking when you pick one. (Materials/fees come from receipts instead,
      // so we keep this to labor only — nothing here can double a receipt.)
      if (fixNum > 0) {
        const { error: fe } = await supabase.rpc('add_piece_expense', {
          p_piece_id: id,
          p_amount: fixNum,
          p_category: 'labor',
          p_note: 'Labor',
          p_crew_member_id: fixCrew || null,
          p_date: dateStr,
        })
        if (fe) bookWarn = ' · labor cost didn’t reach Books (did the SQL update get run?)'
      }
      const { error: se } = await supabase.rpc('record_piece_sale', {
        p_piece_id: id,
        p_amount: sp,
        p_date: dateStr,
      })
      if (se) bookWarn = ' · sale didn’t reach Books (check your Books accounts)'
    }
    setSaving(false)

    setSavedCount((c) => c + n)
    setLastSaved(
      `${n > 1 ? n + '× ' : ''}${baseTitle} — ${money(sp)} each (${month})${photoWarn}${bookWarn}`
    )

    if (addAnother) {
      // Keep the month so logging a run of same-month sales is fast.
      setTitle('')
      setPaid('')
      setSoldFor('')
      setFixUp('')
      setFixCrew('')
      setQty('1')
      clearFile()
    } else {
      // Land on the Pipeline showing this sale's month, with the piece open so
      // you can add more to it right away.
      router.push(`/flipper/pipeline?sold=m:${month}&focus=${ids[0]}`)
      router.refresh()
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {savedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          Added {savedCount} {savedCount === 1 ? 'sale' : 'sales'}
          {lastSaved ? <span className="text-muted-foreground">· last: {lastSaved}</span> : null}
        </div>
      )}

      <div className="rounded-xl border border-border p-4 space-y-3">
        <label className="block text-xs text-muted-foreground">
          What was it?
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Mid-century dresser"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Photo (optional)</span>
          {preview ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt=""
                className="h-16 w-16 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={clearFile}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <ImagePlus className="h-4 w-4" />
              Add a photo
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            What you paid (each)
            <input
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Sold for (each)
            <input
              value={soldFor}
              onChange={(e) => setSoldFor(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-2">
          <span className="block text-xs font-medium text-foreground">
            Labor cost (optional)
          </span>
          <p className="text-xs text-muted-foreground">
            Money you paid someone to help fix it up. Leave blank if there was none.
            Materials and fees go on a receipt instead — log those with the receipt
            scanner so nothing gets counted twice.
          </p>
          <label className="block text-xs text-muted-foreground">
            How much (each)
            <input
              value={fixUp}
              onChange={(e) => setFixUp(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <div className="space-y-1.5">
            <label className="block text-xs text-muted-foreground">
              Who did you pay? <span className="text-muted-foreground/70">(for 1099 tracking)</span>
              <select
                value={fixCrew}
                onChange={(e) => setFixCrew(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">Not sure / skip</option>
                {crewList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {addingPerson ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={newPerson}
                  onChange={(e) => setNewPerson(e.target.value)}
                  placeholder="Their name"
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button
                  type="button"
                  disabled={savingPerson || !newPerson.trim()}
                  onClick={addPerson}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                >
                  {savingPerson ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingPerson(false)
                    setNewPerson('')
                  }}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPerson(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a person
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            How many? <span className="text-muted-foreground/70">(same price each)</span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              type="number"
              min="1"
              max="100"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <div className="flex items-end pb-2">
            {(() => {
              const n = Math.max(1, Math.min(100, parseInt(qty, 10) || 1))
              const sp = parseFloat(soldFor)
              if (n > 1 && !isNaN(sp) && sp > 0) {
                return (
                  <p className="text-xs text-muted-foreground">
                    {n} pieces · {money(sp * n)} total
                  </p>
                )
              }
              return null
            })()}
          </div>
        </div>

        <label className="block text-xs text-muted-foreground">
          Month it sold <span className="text-muted-foreground/70">(set to now — change only for older sales)</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>

        {err && <p className="text-xs text-red-600">{err}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save & add another'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Save &amp; finish
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Each saved sale shows up in your Pipeline as a sold piece and lands in Books on the
        15th of the month you picked. You can fine-tune the exact day later by opening the
        piece in the Pipeline.
      </p>
    </div>
  )
}
