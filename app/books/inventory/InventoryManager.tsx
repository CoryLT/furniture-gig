'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Minus, Trash2, Pencil, Package, AlertTriangle, X, Check } from 'lucide-react'

export type InvItem = {
  id: string
  name: string
  unit: string | null
  avg_cost: number
  quantity: number
  reorder_level: number | null
  imageUrl: string | null
}

const money = (v: number) =>
  '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Quantities can be whole or fractional; show clean numbers.
const qty = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100))

const isLow = (it: InvItem) => it.reorder_level != null && it.quantity <= it.reorder_level

export default function InventoryManager({
  initialItems,
  me,
}: {
  initialItems: InvItem[]
  me: string
}) {
  const supabase = createClient()
  const [items, setItems] = useState<InvItem[]>(initialItems)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items
  }, [items, search])

  const totalValue = useMemo(
    () => items.reduce((s, it) => s + it.avg_cost * it.quantity, 0),
    [items]
  )
  const lowItems = useMemo(() => items.filter(isLow), [items])

  // ---- quick quantity bump (+/-) ----
  async function bump(it: InvItem, delta: number) {
    const next = Math.max(0, Math.round((it.quantity + delta) * 100) / 100)
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, quantity: next } : x)))
    setBusy(it.id)
    const { error: e } = await supabase
      .from('books_inventory_items')
      .update({ quantity: next })
      .eq('id', it.id)
    setBusy(null)
    if (e) {
      setError('Could not save the new count. Try again.')
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, quantity: it.quantity } : x)))
    }
  }

  async function remove(it: InvItem) {
    if (!window.confirm(`Delete "${it.name}" from your supplies? This can't be undone.`)) return
    setBusy(it.id)
    const { error: e } = await supabase.from('books_inventory_items').delete().eq('id', it.id)
    setBusy(null)
    if (e) {
      setError('Could not delete that item. Try again.')
      return
    }
    setItems((prev) => prev.filter((x) => x.id !== it.id))
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Money in supplies
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{money(totalValue)}</div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Running low
          </div>
          <div
            className={
              'mt-1 text-2xl font-semibold ' +
              (lowItems.length > 0 ? 'text-amber-600' : 'text-foreground')
            }
          >
            {lowItems.length}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplies…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v)
            setEditing(null)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <ItemForm
          me={me}
          onCancel={() => setAdding(false)}
          onSaved={(it) => {
            setItems((prev) => [...prev, it].sort((a, b) => a.name.localeCompare(b.name)))
            setAdding(false)
          }}
        />
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? 'No supplies yet. Add your first item above.' : 'No matches.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((it) =>
            editing === it.id ? (
              <li key={it.id}>
                <ItemForm
                  me={me}
                  existing={it}
                  onCancel={() => setEditing(null)}
                  onSaved={(updated) => {
                    setItems((prev) =>
                      prev
                        .map((x) => (x.id === updated.id ? updated : x))
                        .sort((a, b) => a.name.localeCompare(b.name))
                    )
                    setEditing(null)
                  }}
                />
              </li>
            ) : (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                    {isLow(it) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        Reorder
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {money(it.avg_cost)} each{it.unit ? ` · ${it.unit}` : ''} ·{' '}
                    {money(it.avg_cost * it.quantity)} on hand
                  </p>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy === it.id}
                    onClick={() => bump(it, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                    aria-label="Use one"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-foreground">
                    {qty(it.quantity)}
                  </span>
                  <button
                    type="button"
                    disabled={busy === it.id}
                    onClick={() => bump(it, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
                    aria-label="Add one"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(it.id)
                      setAdding(false)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function ItemForm({
  me,
  existing,
  onCancel,
  onSaved,
}: {
  me: string
  existing?: InvItem
  onCancel: () => void
  onSaved: (it: InvItem) => void
}) {
  const supabase = createClient()
  const [name, setName] = useState(existing?.name ?? '')
  const [unit, setUnit] = useState(existing?.unit ?? '')
  const [cost, setCost] = useState(existing ? String(existing.avg_cost) : '')
  const [count, setCount] = useState(existing ? String(existing.quantity) : '')
  const [reorder, setReorder] = useState(
    existing?.reorder_level == null ? '' : String(existing.reorder_level)
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!name.trim()) {
      setErr('Give the item a name.')
      return
    }
    setSaving(true)
    setErr('')
    const payload = {
      name: name.trim(),
      unit: unit.trim() || null,
      avg_cost: parseFloat(cost) || 0,
      quantity: parseFloat(count) || 0,
      reorder_level: reorder.trim() === '' ? null : parseFloat(reorder) || 0,
    }

    if (existing) {
      const { error } = await supabase
        .from('books_inventory_items')
        .update(payload)
        .eq('id', existing.id)
      setSaving(false)
      if (error) {
        setErr('Could not save. Try again.')
        return
      }
      onSaved({ ...existing, ...payload })
    } else {
      const { data, error } = await supabase
        .from('books_inventory_items')
        .insert({ ...payload, owner_user_id: me })
        .select('id')
        .single()
      setSaving(false)
      if (error || !data) {
        setErr('Could not add the item. Try again.')
        return
      }
      onSaved({ id: (data as any).id, ...payload, imageUrl: null })
    }
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name (e.g., 3” Gold Modern Pull)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Cost each ($)
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          How many on hand
          <input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Unit (optional)
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Each, Pair…"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Reorder when below (optional)
          <input
            value={reorder}
            onChange={(e) => setReorder(e.target.value)}
            inputMode="decimal"
            placeholder="e.g., 4"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add to inventory'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  )
}
