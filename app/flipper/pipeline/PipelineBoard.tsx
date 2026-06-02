'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, ArrowRight, Trash2 } from 'lucide-react'

type Stage = 'sourced' | 'in_progress' | 'listed' | 'sold'

type Piece = {
  id: string
  title: string
  stage: Stage
  source: string | null
  acquisition_cost: number | null
  materials_cost: number | null
  labor_cost: number | null
  target_price: number | null
  sale_price: number | null
  notes: string | null
  acquired_at: string | null
  listed_at: string | null
  sold_at: string | null
}

const STAGES: { key: Stage; label: string }[] = [
  { key: 'sourced', label: 'Sourced' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'listed', label: 'Listed' },
  { key: 'sold', label: 'Sold' },
]
const ORDER: Stage[] = ['sourced', 'in_progress', 'listed', 'sold']

const n = (v: any) => Number(v ?? 0)
const costsOf = (p: Piece) =>
  n(p.acquisition_cost) + n(p.materials_cost) + n(p.labor_cost)
const realized = (p: Piece) => n(p.sale_price) - costsOf(p)
const expected = (p: Piece) => n(p.target_price) - costsOf(p)
const money = (v: number) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`

export default function PipelineBoard({
  userId,
  initialPieces,
}: {
  userId: string
  initialPieces: Piece[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pieces, setPieces] = useState<Piece[]>(initialPieces)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  // ---- HUD numbers (recomputed from state) ----
  const unsold = pieces.filter((p) => p.stage !== 'sold')
  const sold = pieces.filter((p) => p.stage === 'sold')
  const tiedUp = unsold.reduce((s, p) => s + costsOf(p), 0)
  const allTimeProfit = sold.reduce((s, p) => s + realized(p), 0)
  const now = new Date()
  const monthProfit = sold
    .filter((p) => {
      if (!p.sold_at) return false
      const d = new Date(p.sold_at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((s, p) => s + realized(p), 0)

  // ---- mutations ----
  async function createPiece(fields: Partial<Piece>) {
    setError('')
    const { data, error: err } = await (supabase.from('inventory_pieces') as any)
      .insert({
        owner_user_id: userId,
        stage: 'sourced',
        acquired_at: new Date().toISOString().slice(0, 10),
        ...fields,
      })
      .select()
      .single()
    if (err || !data) {
      setError('Could not add the piece. Try again.')
      return
    }
    setPieces((prev) => [data as Piece, ...prev])
    setAdding(false)
    router.refresh()
  }

  async function updatePiece(id: string, patch: Partial<Piece>) {
    setError('')
    const { error: err } = await (supabase.from('inventory_pieces') as any)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) {
      setError('Could not save. Try again.')
      return false
    }
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    router.refresh()
    return true
  }

  async function deletePiece(id: string) {
    setError('')
    const { error: err } = await (supabase.from('inventory_pieces') as any)
      .delete()
      .eq('id', id)
    if (err) {
      setError('Could not delete. Try again.')
      return
    }
    setPieces((prev) => prev.filter((p) => p.id !== id))
    router.refresh()
  }

  function advance(piece: Piece) {
    const i = ORDER.indexOf(piece.stage)
    if (i >= ORDER.length - 1) return
    const next = ORDER[i + 1]
    const patch: Partial<Piece> = { stage: next }
    if (next === 'listed' && !piece.listed_at) {
      patch.listed_at = new Date().toISOString()
    }
    if (next === 'sold') {
      const input = window.prompt(
        'Sold! What did it sell for?',
        piece.target_price ? String(piece.target_price) : ''
      )
      if (input === null) return
      const sp = parseFloat(input)
      if (isNaN(sp)) {
        setError('Enter a number for the sale price.')
        return
      }
      patch.sale_price = sp
      patch.sold_at = new Date().toISOString()
    }
    updatePiece(piece.id, patch)
  }

  return (
    <div className="space-y-6">
      {/* HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Cash tied up" value={money(tiedUp)} hint={`${unsold.length} in progress`} />
        <Stat label="In the pipeline" value={String(unsold.length)} hint="pieces not yet sold" />
        <Stat label="Profit this month" value={money(monthProfit)} hint="from pieces sold" accent />
        <Stat label="All-time profit" value={money(allTimeProfit)} hint={`${sold.length} flipped`} accent />
      </div>

      {/* Add */}
      <div>
        {adding ? (
          <AddPieceForm onCancel={() => setAdding(false)} onCreate={createPiece} />
        ) : (
          <Button variant="accent" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" />
            Add a piece
          </Button>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const inStage = pieces.filter((p) => p.stage === stage.key)
          return (
            <div key={stage.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{stage.label}</h2>
                <span className="text-xs text-muted-foreground">{inStage.length}</span>
              </div>
              <div className="space-y-3">
                {inStage.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                    Nothing here yet
                  </p>
                ) : (
                  inStage.map((p) => (
                    <PieceCard
                      key={p.id}
                      piece={p}
                      onAdvance={advance}
                      onUpdate={updatePiece}
                      onDelete={deletePiece}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="card card-body">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${accent ? 'text-accent' : 'text-foreground'}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function AddPieceForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (fields: Partial<Piece>) => void
}) {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [acq, setAcq] = useState('')
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    await onCreate({
      title: title.trim(),
      source: source.trim() || null,
      acquisition_cost: acq ? parseFloat(acq) || 0 : 0,
      target_price: target ? parseFloat(target) : null,
    })
    setSaving(false)
  }

  return (
    <div className="card card-body space-y-3">
      <p className="font-semibold text-foreground text-sm">New piece</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What is it? e.g. Mid-century dresser"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <input
        type="text"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Where from? e.g. FB Marketplace, estate sale"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted-foreground">
          What you paid
          <input
            type="number"
            value={acq}
            onChange={(e) => setAcq(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Target price
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="accent" onClick={submit} disabled={saving || !title.trim()}>
          {saving ? 'Adding…' : 'Add piece'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PieceCard({
  piece,
  onAdvance,
  onUpdate,
  onDelete,
}: {
  piece: Piece
  onAdvance: (p: Piece) => void
  onUpdate: (id: string, patch: Partial<Piece>) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acq, setAcq] = useState(String(piece.acquisition_cost ?? ''))
  const [mat, setMat] = useState(String(piece.materials_cost ?? ''))
  const [lab, setLab] = useState(String(piece.labor_cost ?? ''))
  const [target, setTarget] = useState(String(piece.target_price ?? ''))
  const [sale, setSale] = useState(String(piece.sale_price ?? ''))

  const isSold = piece.stage === 'sold'
  const profit = isSold ? realized(piece) : expected(piece)
  const hasProfit = isSold || piece.target_price != null

  async function save() {
    setSaving(true)
    const patch: Partial<Piece> = {
      acquisition_cost: acq ? parseFloat(acq) || 0 : 0,
      materials_cost: mat ? parseFloat(mat) || 0 : 0,
      labor_cost: lab ? parseFloat(lab) || 0 : 0,
      target_price: target ? parseFloat(target) : null,
    }
    if (isSold) patch.sale_price = sale ? parseFloat(sale) : null
    const ok = await onUpdate(piece.id, patch)
    setSaving(false)
    if (ok) setOpen(false)
  }

  const nextLabel =
    piece.stage === 'sourced'
      ? 'Start work'
      : piece.stage === 'in_progress'
      ? 'List it'
      : piece.stage === 'listed'
      ? 'Mark sold'
      : null

  return (
    <div className="card card-body space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{piece.title || 'Untitled piece'}</p>
          {piece.source && (
            <p className="text-xs text-muted-foreground truncate">{piece.source}</p>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex justify-between">
          <span>In so far</span>
          <span className="text-foreground">{money(costsOf(piece))}</span>
        </div>
        {isSold ? (
          <div className="flex justify-between">
            <span>Sold for</span>
            <span className="text-foreground">{money(n(piece.sale_price))}</span>
          </div>
        ) : (
          piece.target_price != null && (
            <div className="flex justify-between">
              <span>Target</span>
              <span className="text-foreground">{money(n(piece.target_price))}</span>
            </div>
          )
        )}
        {hasProfit && (
          <div className="flex justify-between pt-1 border-t border-border">
            <span>{isSold ? 'Profit' : 'Projected'}</span>
            <span className={profit >= 0 ? 'text-accent font-semibold' : 'text-red-600 font-semibold'}>
              {money(profit)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {nextLabel && (
          <Button variant="accent" onClick={() => onAdvance(piece)}>
            {nextLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground ml-auto"
        >
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      {open && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Paid" value={acq} onChange={setAcq} />
            <NumField label="Materials" value={mat} onChange={setMat} />
            <NumField label="Labor" value={lab} onChange={setLab} />
          </div>
          <div className={`grid ${isSold ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            <NumField label="Target price" value={target} onChange={setTarget} />
            {isSold && <NumField label="Sold for" value={sale} onChange={setSale} />}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${piece.title || 'this piece'}"? This can't be undone.`)) {
                  onDelete(piece.id)
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </label>
  )
}
