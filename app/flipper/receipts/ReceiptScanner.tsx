'use client'

import { useState } from 'react'
import { ImageIcon, CheckCircle2, Plus, X } from 'lucide-react'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'

type Piece = { id: string; title: string }
type Account = { id: string; name: string; type: string }

type Line = {
  key: string
  description: string
  amount: string
  expenseAccountId: string
  pieceId: string
}

const newKey = () => Math.random().toString(36).slice(2)

export default function ReceiptScanner({
  pieces,
  expenseAccounts,
  assetAccounts,
}: {
  pieces: Piece[]
  expenseAccounts: Account[]
  assetAccounts: Account[]
}) {
  const defaultExpense = expenseAccounts[0]?.id ?? ''
  const defaultPaidFrom = assetAccounts[0]?.id ?? ''

  const [phase, setPhase] = useState<
    'idle' | 'reading' | 'review' | 'saving' | 'saved' | 'error'
  >('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileToSave, setFileToSave] = useState<File | null>(null)

  const [vendor, setVendor] = useState('')
  const [date, setDate] = useState('')
  const [paidFrom, setPaidFrom] = useState(defaultPaidFrom)
  const [lines, setLines] = useState<Line[]>([])
  const [result, setResult] = useState<{ lines: number; tagged: number; attached: boolean } | null>(
    null
  )

  function reset() {
    setPhase('idle')
    setError('')
    setPreview(null)
    setFileToSave(null)
    setVendor('')
    setDate('')
    setPaidFrom(defaultPaidFrom)
    setLines([])
    setResult(null)
  }

  function blankLine(): Line {
    return {
      key: newKey(),
      description: '',
      amount: '',
      expenseAccountId: defaultExpense,
      pieceId: '',
    }
  }

  async function onPick(file: File | null) {
    if (!file) return
    setError('')
    if (!isAcceptableImageFile(file)) {
      setError('That file type isn\u2019t supported. Try a JPG or PNG photo.')
      return
    }
    setPhase('reading')
    setPreview(URL.createObjectURL(file))

    let toSend = file
    try {
      toSend = await compressImageForUpload(file)
    } catch {
      // fall back to original
    }
    setFileToSave(toSend)

    try {
      const fd = new FormData()
      fd.append('file', toSend)
      const res = await fetch('/api/receipts/scan', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) {
        setVendor(json.vendor || '')
        setDate(json.date || '')
        const fromItems: Line[] = (json.items || [])
          .filter((it: any) => Number.isFinite(it.amount) && it.amount > 0)
          .map((it: any) => ({
            key: newKey(),
            description: it.description || '',
            amount: String(it.amount),
            expenseAccountId: defaultExpense,
            pieceId: '',
          }))
        setLines(fromItems.length ? fromItems : [blankLine()])
      } else {
        setLines([blankLine()])
        setError('Couldn\u2019t read that one \u2014 add the lines by hand.')
      }
    } catch {
      setLines([blankLine()])
      setError('Couldn\u2019t read that one \u2014 add the lines by hand.')
    }
    setPhase('review')
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, blankLine()])
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)

  async function save() {
    setError('')
    if (!paidFrom) {
      setError('Pick which account this was paid from.')
      return
    }
    const payload = lines
      .map((l) => ({
        description: l.description.trim(),
        amount: parseFloat(l.amount),
        expenseAccountId: l.expenseAccountId,
        pieceId: l.pieceId || null,
      }))
      .filter((l) => Number.isFinite(l.amount) && l.amount > 0)
    if (payload.length === 0) {
      setError('Add at least one line with an amount.')
      return
    }
    if (payload.some((l) => !l.expenseAccountId)) {
      setError('Pick a category for every line.')
      return
    }
    if (!fileToSave) {
      setError('Add a receipt photo first.')
      return
    }
    setPhase('saving')
    try {
      const fd = new FormData()
      fd.append('file', fileToSave)
      fd.append('vendor', vendor)
      fd.append('date', date)
      fd.append('paidFromAccountId', paidFrom)
      fd.append('lines', JSON.stringify(payload))
      const res = await fetch('/api/receipts/save', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) {
        setPhase('review')
        setError(
          json.error === 'no_category'
            ? 'Pick a category for every line.'
            : json.error === 'bad_paid_from' || json.error === 'no_paid_from'
            ? 'Pick which account this was paid from.'
            : 'Couldn\u2019t save to your books. Please try again.'
        )
        return
      }
      setResult({ lines: json.lines || 0, tagged: json.tagged || 0, attached: !!json.attached })
      setPhase('saved')
    } catch {
      setPhase('review')
      setError('Couldn\u2019t save to your books. Please try again.')
    }
  }

  const inputCls =
    'rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  if (phase === 'saved') {
    return (
      <div className="card card-body space-y-3">
        <div className="flex items-center gap-2 text-foreground">
          <CheckCircle2 className="w-5 h-5 text-accent" />
          <p className="font-medium">Saved to your books</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {result?.lines} expense{result?.lines === 1 ? '' : 's'} logged
          {result?.tagged ? `, ${result.tagged} tagged to a piece` : ''}
          {result?.attached
            ? ', with the receipt photo attached.'
            : '. (The photo couldn\u2019t attach this time, but the expense is saved.)'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-accent hover:underline w-fit"
        >
          Snap another
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card card-body space-y-3">
        <label className="text-sm text-accent hover:underline cursor-pointer inline-flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4" />
          {phase === 'reading' ? 'Reading\u2026' : 'Take or choose a receipt photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={phase === 'reading' || phase === 'saving'}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
        {preview && (
          <img
            src={preview}
            alt="receipt"
            className="w-full max-h-64 object-contain rounded-lg border border-border"
          />
        )}
      </div>

      {(phase === 'review' || phase === 'saving') && (
        <div className="card card-body space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground block">
              Vendor
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Store name"
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
            <label className="text-xs text-muted-foreground block">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`mt-1 w-full ${inputCls}`}
              />
            </label>
          </div>

          <label className="text-xs text-muted-foreground block">
            Paid from
            <select
              value={paidFrom}
              onChange={(e) => setPaidFrom(e.target.value)}
              className={`mt-1 w-full ${inputCls}`}
            >
              <option value="">Choose an account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-foreground">
              Lines — pick a category, and tag to a piece or leave general
            </p>
            {lines.map((l) => (
              <div key={l.key} className="space-y-1.5 rounded-lg border border-border p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={l.description}
                    onChange={(e) => updateLine(l.key, { description: e.target.value })}
                    placeholder="What is it?"
                    className={`flex-1 min-w-0 ${inputCls}`}
                  />
                  <input
                    type="number"
                    value={l.amount}
                    onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                    placeholder="$"
                    className={`w-20 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(l.key)}
                    className="text-muted-foreground hover:text-red-600 shrink-0"
                    aria-label="Remove line"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={l.expenseAccountId}
                    onChange={(e) => updateLine(l.key, { expenseAccountId: e.target.value })}
                    className={`flex-1 ${inputCls}`}
                  >
                    <option value="">Category…</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={l.pieceId}
                    onChange={(e) => updateLine(l.key, { pieceId: e.target.value })}
                    className={`flex-1 ${inputCls}`}
                  >
                    <option value="">General (no piece)</option>
                    {pieces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add a line
            </button>

            <p className="text-xs text-muted-foreground">
              Lines total: <span className="text-foreground">${total.toFixed(2)}</span>
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={phase === 'saving'}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 w-fit transition-colors"
          >
            {phase === 'saving' ? 'Saving\u2026' : 'Save to my books'}
          </button>
        </div>
      )}
    </div>
  )
}
