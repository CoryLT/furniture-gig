'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, ArrowRight, Trash2, ImageIcon, X, ChevronDown, Users, Package } from 'lucide-react'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'
import FindHelpCard, { type HelpAd } from '@/components/pipeline/FindHelpCard'

type Stage = 'sourced' | 'in_progress' | 'listed' | 'sold'

type Expense = {
  id: string
  amount: number | null
  category: string | null
  note: string
  spent_on: string | null
}

type UsedSupply = {
  id: string
  item_id: string | null
  item_name: string
  unit_cost: number
  qty: number
}

type InvItem = {
  id: string
  name: string
  unit: string | null
  avg_cost: number
  quantity: number
  reorder_level: number | null
}

type Piece = {
  id: string
  title: string
  stage: Stage
  source: string | null
  acquisition_cost: number | null
  target_price: number | null
  sale_price: number | null
  image_path: string | null
  notes: string | null
  acquired_at: string | null
  listed_at: string | null
  sold_at: string | null
  help_ad: HelpAd | null
  expenses: Expense[]
  supplies: UsedSupply[]
}

const STAGES: { key: Stage; label: string }[] = [
  { key: 'sourced', label: 'Sourced' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'listed', label: 'Listed' },
  { key: 'sold', label: 'Sold' },
]
const ORDER: Stage[] = ['sourced', 'in_progress', 'listed', 'sold']
const CATEGORIES = ['purchase', 'materials', 'labor', 'transport', 'fees', 'other']

const n = (v: any) => Number(v ?? 0)
const sumExpenses = (p: Piece) => (p.expenses ?? []).reduce((s, e) => s + n(e.amount), 0)
const costsOf = (p: Piece) => n(p.acquisition_cost) + sumExpenses(p)
const realized = (p: Piece) => n(p.sale_price) - costsOf(p)
const expected = (p: Piece) => n(p.target_price) - costsOf(p)
const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`

export default function PipelineBoard({
  userId,
  initialPieces,
  crew,
  inventory: initialInventory,
}: {
  userId: string
  initialPieces: Piece[]
  crew: { id: string; label: string }[]
  inventory: InvItem[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [pieces, setPieces] = useState<Piece[]>(initialPieces)
  const [inventory, setInventory] = useState<InvItem[]>(initialInventory)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [openStat, setOpenStat] = useState<string | null>(null)

  function imageUrl(path?: string | null) {
    if (!path) return null
    return supabase.storage.from('marketplace-photos').getPublicUrl(path).data.publicUrl
  }

  // ---- HUD numbers ----
  const unsold = pieces.filter((p) => p.stage !== 'sold')
  const sold = pieces.filter((p) => p.stage === 'sold')
  const tiedUp = unsold.reduce((s, p) => s + costsOf(p), 0)
  const allTimeProfit = sold.reduce((s, p) => s + realized(p), 0)
  const now = new Date()
  const soldThisMonth = sold.filter((p) => {
    if (!p.sold_at) return false
    const d = new Date(p.sold_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthProfit = soldThisMonth.reduce((s, p) => s + realized(p), 0)

  // ---- image upload (shared moderation flow) ----
  async function uploadImage(pieceId: string, file: File): Promise<string | null> {
    if (!isAcceptableImageFile(file)) {
      setError('That file type isn\u2019t supported. Try a JPG or PNG.')
      return null
    }
    let toSend = file
    try {
      toSend = await compressImageForUpload(file)
    } catch {
      // fall back to original
    }
    const fd = new FormData()
    fd.append('file', toSend)
    fd.append('pieceId', pieceId)
    try {
      const res = await fetch('/api/upload-piece-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json?.image?.file_path) {
        setError(json?.error || 'Photo upload failed.')
        return null
      }
      return json.image.file_path as string
    } catch {
      setError('Photo upload failed.')
      return null
    }
  }

  function setPieceImage(id: string, path: string) {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, image_path: path } : p)))
  }

  async function handlePhoto(pieceId: string, file: File) {
    setError('')
    const path = await uploadImage(pieceId, file)
    if (path) setPieceImage(pieceId, path)
    return !!path
  }

  // ---- piece mutations ----
  async function createPiece(fields: Partial<Piece>, file?: File | null) {
    setError('')
    const { acquisition_cost: acqCost, ...rest } = fields as any
    const { data, error: err } = await (supabase.from('inventory_pieces') as any)
      .insert({
        owner_user_id: userId,
        stage: 'sourced',
        acquired_at: new Date().toISOString().slice(0, 10),
        ...rest,
      })
      .select()
      .single()
    if (err || !data) {
      setError('Could not add the piece. Try again.')
      return
    }
    // Purchase price becomes a ledger expense tagged to the piece — the one
    // source of truth. (No separate piece column anymore.)
    if (acqCost && Number(acqCost) > 0) {
      await supabase.rpc('set_piece_purchase', {
        p_piece_id: (data as any).id,
        p_amount: Number(acqCost),
      })
    }
    const piece = {
      ...(data as Piece),
      acquisition_cost: Number(acqCost) || 0,
      expenses: [] as Expense[],
    }
    if (file) {
      const path = await uploadImage(piece.id, file)
      if (path) piece.image_path = path
    }
    setPieces((prev) => [piece, ...prev])
    setAdding(false)
    router.refresh()
  }

  async function updatePiece(id: string, patch: Partial<Piece>) {
    setError('')
    const { acquisition_cost: acqPatch, ...colPatch } = patch as any
    if (acqPatch !== undefined) {
      await supabase.rpc('set_piece_purchase', { p_piece_id: id, p_amount: Number(acqPatch) || 0 })
    }
    if (Object.keys(colPatch).length > 0) {
      const { error: err } = await (supabase.from('inventory_pieces') as any)
        .update({ ...colPatch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (err) {
        setError('Could not save. Try again.')
        return false
      }
    }
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    router.refresh()
    return true
  }

  async function deletePiece(id: string) {
    setError('')
    const { error: err } = await (supabase.from('inventory_pieces') as any).delete().eq('id', id)
    if (err) {
      setError('Could not delete. Try again.')
      return
    }
    setPieces((prev) => prev.filter((p) => p.id !== id))
    router.refresh()
  }

  // ---- expense mutations ----
  async function addExpense(
    pieceId: string,
    fields: { amount: number; note: string; category: string | null; crewMemberId?: string | null }
  ) {
    setError('')
    const { data, error: err } = await supabase.rpc('add_piece_expense', {
      p_piece_id: pieceId,
      p_amount: fields.amount,
      p_category: fields.category,
      p_note: fields.note,
      p_crew_member_id: fields.crewMemberId ?? null,
    })
    const row: any = Array.isArray(data) ? data[0] : data
    if (err || !row) {
      setError('Could not add expense. Try again.')
      return false
    }
    const exp: Expense = {
      id: row.txn_id,
      amount: Number(row.amount),
      category: row.category,
      note: row.note || '',
      spent_on: row.spent_on,
    }
    setPieces((prev) =>
      prev.map((p) =>
        p.id === pieceId ? { ...p, expenses: [...(p.expenses ?? []), exp] } : p
      )
    )
    // If you tagged a worker, see if this payment crosses their 1099 line.
    if (fields.crewMemberId) {
      try {
        await fetch('/api/payments/check-1099', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crewMemberId: fields.crewMemberId }),
        })
      } catch {}
    }
    router.refresh()
    return true
  }

  // ---- supplies used on a piece (from the inventory tracker) ----
  async function useSupply(pieceId: string, itemId: string, q: number) {
    setError('')
    const { data, error: err } = await supabase.rpc('use_supply_on_piece', {
      p_item_id: itemId,
      p_piece_id: pieceId,
      p_qty: q,
    })
    const row: any = Array.isArray(data) ? data[0] : data
    if (err || !row) {
      setError('Could not use that supply. Try again.')
      return false
    }
    const used: UsedSupply = {
      id: row.usage_id,
      item_id: itemId,
      item_name: row.item_name || '',
      unit_cost: Number(row.unit_cost ?? 0),
      qty: Number(row.qty ?? q),
    }
    setPieces((prev) =>
      prev.map((p) =>
        p.id === pieceId ? { ...p, supplies: [...(p.supplies ?? []), used] } : p
      )
    )
    setInventory((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, quantity: Number(row.new_quantity ?? it.quantity) } : it))
    )
    return true
  }

  async function removeSupply(pieceId: string, usage: UsedSupply) {
    setError('')
    const { error: err } = await supabase.rpc('remove_piece_supply', { p_id: usage.id })
    if (err) {
      setError('Could not undo that. Try again.')
      return
    }
    setPieces((prev) =>
      prev.map((p) =>
        p.id === pieceId
          ? { ...p, supplies: (p.supplies ?? []).filter((s) => s.id !== usage.id) }
          : p
      )
    )
    if (usage.item_id) {
      setInventory((prev) =>
        prev.map((it) =>
          it.id === usage.item_id ? { ...it, quantity: it.quantity + usage.qty } : it
        )
      )
    }
  }

  async function deleteExpense(pieceId: string, expenseId: string) {
    setError('')
    // expenseId is now the ledger transaction id; deleting it cascades its lines.
    const { error: err } = await (supabase.from('transactions') as any)
      .delete()
      .eq('id', expenseId)
    if (err) {
      setError('Could not remove expense. Try again.')
      return
    }
    setPieces((prev) =>
      prev.map((p) =>
        p.id === pieceId
          ? { ...p, expenses: (p.expenses ?? []).filter((e) => e.id !== expenseId) }
          : p
      )
    )
    router.refresh()
  }

  function advance(piece: Piece) {
    const i = ORDER.indexOf(piece.stage)
    if (i >= ORDER.length - 1) return
    const next = ORDER[i + 1]
    const patch: Partial<Piece> = { stage: next }
    if (next === 'listed' && !piece.listed_at) patch.listed_at = new Date().toISOString()
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
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat
            label="Cash tied up"
            value={money(tiedUp)}
            hint={`${unsold.length} in progress`}
            selected={openStat === 'tied_up'}
            onClick={() => setOpenStat((k) => (k === 'tied_up' ? null : 'tied_up'))}
          />
          <Stat
            label="In the pipeline"
            value={String(unsold.length)}
            hint="pieces not yet sold"
            selected={openStat === 'count'}
            onClick={() => setOpenStat((k) => (k === 'count' ? null : 'count'))}
          />
          <Stat
            label="Profit this month"
            value={money(monthProfit)}
            hint="from pieces sold"
            accent
            selected={openStat === 'month'}
            onClick={() => setOpenStat((k) => (k === 'month' ? null : 'month'))}
          />
          <Stat
            label="All-time profit"
            value={money(allTimeProfit)}
            hint={`${sold.length} flipped`}
            accent
            selected={openStat === 'alltime'}
            onClick={() => setOpenStat((k) => (k === 'alltime' ? null : 'alltime'))}
          />
        </div>
        {openStat && (
          <div className="mt-3">
            <StatDetail
              statKey={openStat}
              onClose={() => setOpenStat(null)}
              unsold={unsold}
              soldThisMonth={soldThisMonth}
              sold={sold}
            />
          </div>
        )}
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
                      imgUrl={imageUrl(p.image_path)}
                      onAdvance={advance}
                      onUpdate={updatePiece}
                      onDelete={deletePiece}
                      onPhoto={handlePhoto}
                      onAddExpense={addExpense}
                      crew={crew}
                      onDeleteExpense={deleteExpense}
                      inventory={inventory}
                      onUseSupply={useSupply}
                      onRemoveSupply={removeSupply}
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
  selected,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`card card-body text-left w-full transition-shadow hover:shadow-md cursor-pointer ${
        selected ? 'ring-2 ring-accent/40' : ''
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${accent ? 'text-accent' : 'text-foreground'}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      <p className="text-[11px] text-accent mt-1">{selected ? 'Hide details' : 'See details'}</p>
    </button>
  )
}

function StatDetail({
  statKey,
  onClose,
  unsold,
  soldThisMonth,
  sold,
}: {
  statKey: string
  onClose: () => void
  unsold: Piece[]
  soldThisMonth: Piece[]
  sold: Piece[]
}) {
  const stageLabel = (s: Stage) => STAGES.find((x) => x.key === s)?.label ?? s
  const dateOf = (d: string | null) => (d ? new Date(d).toLocaleDateString() : undefined)

  type Row = { id: string; name: string; sub?: string; value: string; tone?: 'good' | 'bad' }

  let title = ''
  let subtitle = ''
  let rows: Row[] = []
  let empty = ''

  if (statKey === 'tied_up') {
    title = 'Cash tied up'
    subtitle = "What you've put into pieces you haven't sold yet."
    rows = [...unsold]
      .sort((a, b) => costsOf(b) - costsOf(a))
      .map((p) => ({
        id: p.id,
        name: p.title || 'Untitled piece',
        sub: stageLabel(p.stage),
        value: money(costsOf(p)),
      }))
    empty = 'No cash tied up — nothing in progress.'
  } else if (statKey === 'count') {
    title = 'In the pipeline'
    subtitle = 'Pieces by stage (not yet sold).'
    const stages: Stage[] = ['sourced', 'in_progress', 'listed']
    rows =
      unsold.length === 0
        ? []
        : stages.map((s) => ({
            id: s,
            name: stageLabel(s),
            value: String(unsold.filter((p) => p.stage === s).length),
          }))
    empty = 'Nothing in the pipeline yet.'
  } else if (statKey === 'month') {
    title = 'Profit this month'
    subtitle = 'Pieces you sold this month and what each one cleared.'
    rows = [...soldThisMonth]
      .sort((a, b) => realized(b) - realized(a))
      .map((p) => ({
        id: p.id,
        name: p.title || 'Untitled piece',
        sub: dateOf(p.sold_at),
        value: money(realized(p)),
        tone: realized(p) >= 0 ? 'good' : 'bad',
      }))
    empty = 'No pieces sold yet this month.'
  } else {
    title = 'All-time profit'
    subtitle = "Every piece you've flipped."
    rows = [...sold]
      .sort((a, b) => (b.sold_at || '').localeCompare(a.sold_at || ''))
      .map((p) => ({
        id: p.id,
        name: p.title || 'Untitled piece',
        sub: dateOf(p.sold_at),
        value: money(realized(p)),
        tone: realized(p) >= 0 ? 'good' : 'bad',
      }))
    empty = 'No flips completed yet.'
  }

  return (
    <div className="card card-body space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y divide-border max-h-80 overflow-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="text-foreground truncate">{r.name}</p>
                {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
              </div>
              <span
                className={`shrink-0 font-medium ${
                  r.tone === 'bad'
                    ? 'text-red-600'
                    : r.tone === 'good'
                    ? 'text-accent'
                    : 'text-foreground'
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddPieceForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (fields: Partial<Piece>, file?: File | null) => void
}) {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [acq, setAcq] = useState('')
  const [target, setTarget] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function pickFile(f: File | null) {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function submit() {
    if (!title.trim()) return
    setSaving(true)
    await onCreate(
      {
        title: title.trim(),
        source: source.trim() || null,
        acquisition_cost: acq ? parseFloat(acq) || 0 : 0,
        target_price: target ? parseFloat(target) : null,
      },
      file
    )
    setSaving(false)
  }

  return (
    <div className="card card-body space-y-3">
      <p className="font-semibold text-foreground text-sm">New piece</p>

      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
          )}
        </div>
        <label className="text-sm text-accent hover:underline cursor-pointer">
          {preview ? 'Change photo' : 'Add a photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

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
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  )
}

function PieceCard({
  piece,
  imgUrl,
  onAdvance,
  onUpdate,
  onDelete,
  onPhoto,
  onAddExpense,
  onDeleteExpense,
  crew,
  inventory,
  onUseSupply,
  onRemoveSupply,
}: {
  piece: Piece
  imgUrl: string | null
  onAdvance: (p: Piece) => void
  onUpdate: (id: string, patch: Partial<Piece>) => Promise<boolean>
  onDelete: (id: string) => void
  onPhoto: (id: string, file: File) => Promise<boolean>
  onAddExpense: (
    id: string,
    fields: { amount: number; note: string; category: string | null; crewMemberId?: string | null }
  ) => Promise<boolean>
  onDeleteExpense: (pieceId: string, expenseId: string) => void
  crew: { id: string; label: string }[]
  inventory: InvItem[]
  onUseSupply: (pieceId: string, itemId: string, qty: number) => Promise<boolean>
  onRemoveSupply: (pieceId: string, usage: UsedSupply) => void
}) {
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [acq, setAcq] = useState(String(piece.acquisition_cost ?? ''))
  const [target, setTarget] = useState(String(piece.target_price ?? ''))
  const [sale, setSale] = useState(String(piece.sale_price ?? ''))
  const [soldDate, setSoldDate] = useState(piece.sold_at ? piece.sold_at.slice(0, 10) : '')
  const [newAmt, setNewAmt] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newCrew, setNewCrew] = useState('')
  const [addingExp, setAddingExp] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSupplies, setShowSupplies] = useState(false)
  const [supplyPick, setSupplyPick] = useState('')
  const [supplyQty, setSupplyQty] = useState('1')
  const [supplySearch, setSupplySearch] = useState('')
  const [usingSupply, setUsingSupply] = useState(false)

  const isSold = piece.stage === 'sold'
  const profit = isSold ? realized(piece) : expected(piece)
  const hasProfit = isSold || piece.target_price != null

  async function save() {
    setSaving(true)
    const patch: Partial<Piece> = {
      acquisition_cost: acq ? parseFloat(acq) || 0 : 0,
      target_price: target ? parseFloat(target) : null,
    }
    if (isSold) {
      patch.sale_price = sale ? parseFloat(sale) : null
      if (soldDate) patch.sold_at = new Date(soldDate + 'T12:00:00').toISOString()
    }
    const ok = await onUpdate(piece.id, patch)
    setSaving(false)
    if (ok) setOpen(false)
  }

  async function choosePhoto(f: File | null) {
    if (!f) return
    setUploading(true)
    await onPhoto(piece.id, f)
    setUploading(false)
  }

  async function addExp() {
    const amt = parseFloat(newAmt)
    if (isNaN(amt)) return
    setAddingExp(true)
    const ok = await onAddExpense(piece.id, {
      amount: amt,
      note: newNote.trim(),
      category: newCat || null,
      crewMemberId: newCat === 'labor' ? newCrew || null : null,
    })
    setAddingExp(false)
    if (ok) {
      setNewAmt('')
      setNewNote('')
      setNewCat('')
      setNewCrew('')
    }
  }

  const nextLabel =
    piece.stage === 'sourced'
      ? 'Start work'
      : piece.stage === 'in_progress'
      ? 'List it'
      : piece.stage === 'listed'
      ? 'Mark sold'
      : null

  const expenses = piece.expenses ?? []

  return (
    <div className="card card-body space-y-2">
      {/* Tap the photo to see it bigger */}
      {imgUrl && (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="block w-full cursor-zoom-in"
          aria-label="View larger photo"
        >
          <img src={imgUrl} alt={piece.title} className="w-full h-28 object-cover rounded-lg" />
        </button>
      )}

      {/* Tap anywhere on this top part to open or close the card's details */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left space-y-2 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{piece.title || 'Untitled piece'}</p>
            {piece.source && <p className="text-xs text-muted-foreground truncate">{piece.source}</p>}
          </div>
          <span className="flex items-center gap-1 text-accent shrink-0 mt-0.5">
            <span className="text-xs font-medium">{open ? 'Close' : 'Edit'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </span>
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
      </button>

      {nextLabel && (
        <Button variant="accent" onClick={() => onAdvance(piece)}>
          {nextLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}

      {open && (
        <div className="space-y-3 pt-2 border-t border-border">
          {/* Photo */}
          <label className="text-sm text-accent hover:underline cursor-pointer inline-flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            {uploading ? 'Uploading…' : imgUrl ? 'Change photo' : 'Add a photo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)}
            />
          </label>

          {/* Find help — make an ad to hire for this piece */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              aria-expanded={showHelp}
            >
              <Users className="w-3.5 h-3.5" />
              {showHelp ? 'Hide find help' : piece.help_ad ? 'Find help (ad saved)' : 'Find help'}
            </button>
            {showHelp && (
              <FindHelpCard
                pieceTitle={piece.title}
                initial={piece.help_ad ?? null}
                onSave={(ad) => onUpdate(piece.id, { help_ad: ad })}
              />
            )}
          </div>

          {/* Hardware from inventory — deducts from your supplies stock */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSupplies((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              aria-expanded={showSupplies}
            >
              <Package className="w-3.5 h-3.5" />
              {showSupplies
                ? 'Hide hardware'
                : (piece.supplies ?? []).length > 0
                  ? `Hardware used (${(piece.supplies ?? []).length})`
                  : 'Add hardware from inventory'}
            </button>

            {showSupplies && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                {/* What's already on this piece */}
                {(piece.supplies ?? []).length > 0 ? (
                  <div className="space-y-1">
                    {(piece.supplies ?? []).map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground truncate">
                          {u.item_name} · {n(u.qty)} × {money(u.unit_cost)}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-foreground">{money(u.unit_cost * u.qty)}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveSupply(piece.id, u)}
                            className="text-muted-foreground hover:text-red-600"
                            aria-label="Undo (put back in stock)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-1 text-xs">
                      <span className="font-medium text-foreground">Hardware used</span>
                      <span className="font-medium text-foreground">
                        {money((piece.supplies ?? []).reduce((s, u) => s + u.unit_cost * u.qty, 0))}
                      </span>
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Already counted in your Supplies expense — shown here so you can see what went
                      into this piece.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nothing from stock on this piece yet.</p>
                )}

                {/* Picker */}
                {inventory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Your supplies inventory is empty. Add items under Books → Supplies.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={supplySearch}
                      onChange={(e) => setSupplySearch(e.target.value)}
                      placeholder="Search your supplies…"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <div className="flex gap-2">
                      <select
                        value={supplyPick}
                        onChange={(e) => setSupplyPick(e.target.value)}
                        className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                      >
                        <option value="">Pick a supply…</option>
                        {inventory
                          .filter(
                            (it) =>
                              !supplySearch.trim() ||
                              it.name.toLowerCase().includes(supplySearch.trim().toLowerCase())
                          )
                          .map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({n(it.quantity)} left)
                            </option>
                          ))}
                      </select>
                      <input
                        value={supplyQty}
                        onChange={(e) => setSupplyQty(e.target.value)}
                        inputMode="decimal"
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                        aria-label="How many"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!supplyPick || usingSupply}
                      onClick={async () => {
                        const q = parseFloat(supplyQty) || 0
                        if (!supplyPick || q <= 0) return
                        setUsingSupply(true)
                        const ok = await onUseSupply(piece.id, supplyPick, q)
                        setUsingSupply(false)
                        if (ok) {
                          setSupplyPick('')
                          setSupplyQty('1')
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {usingSupply ? 'Using…' : 'Use on this piece'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expenses ledger */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Expenses</p>
            {expenses.length > 0 ? (
              <div className="space-y-1">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground truncate">
                      {e.note || e.category || 'Expense'}
                      {e.note && e.category ? ` · ${e.category}` : ''}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-foreground">{money(n(e.amount))}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(piece.id, e.id)}
                        className="text-muted-foreground hover:text-red-600"
                        aria-label="Remove expense"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No expenses logged yet.</p>
            )}

            {/* Add expense */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={newAmt}
                  onChange={(e) => setNewAmt(e.target.value)}
                  placeholder="$"
                  className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="What for? e.g. paint"
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">Category (optional)</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button variant="accent" onClick={addExp} disabled={addingExp || !newAmt}>
                  {addingExp ? 'Adding…' : 'Add'}
                </Button>
              </div>
              {newCat === 'labor' && crew.length > 0 && (
                <select
                  value={newCrew}
                  onChange={(e) => setNewCrew(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">Who did you pay? (for 1099 tracking)</option>
                  {crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Prices */}
          <div className={`grid ${isSold ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            <NumField label="Paid" value={acq} onChange={setAcq} />
            <NumField label="Target" value={target} onChange={setTarget} />
            {isSold && <NumField label="Sold for" value={sale} onChange={setSale} />}
          </div>
          {isSold && (
            <label className="block text-xs text-muted-foreground">
              Sale date
              <input
                type="date"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
          )}
          <div className="flex items-center gap-3">
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${piece.title || 'this piece'}"? This can\u2019t be undone.`)) {
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

      {zoom && imgUrl && (
        <div
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          role="dialog"
          aria-label="Larger photo"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl}
            alt={piece.title}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
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
