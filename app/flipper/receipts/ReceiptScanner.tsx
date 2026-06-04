'use client'

import { useState } from 'react'
import { ImageIcon, CheckCircle2 } from 'lucide-react'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'

type Account = { id: string; name: string; paymentType?: string }

export default function ReceiptScanner() {
  const [phase, setPhase] = useState<
    'idle' | 'reading' | 'review' | 'saving' | 'saved' | 'error'
  >('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileToSave, setFileToSave] = useState<File | null>(null)

  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

  const [paidFrom, setPaidFrom] = useState<Account[]>([])
  const [categories, setCategories] = useState<Account[]>([])
  const [paidFromId, setPaidFromId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [result, setResult] = useState<{ attached: boolean } | null>(null)

  function reset() {
    setPhase('idle')
    setError('')
    setPreview(null)
    setFileToSave(null)
    setVendor('')
    setAmount('')
    setDate('')
    setResult(null)
  }

  async function loadAccounts() {
    try {
      const res = await fetch('/api/quickbooks/accounts')
      const json = await res.json()
      if (!json.ok) return
      setPaidFrom(json.paidFrom || [])
      setCategories(json.categories || [])
      if (json.paidFrom?.[0]) setPaidFromId(json.paidFrom[0].id)
      if (json.categories?.length) {
        const supplies = json.categories.find((c: Account) =>
          /suppl/i.test(c.name)
        )
        setCategoryId((supplies || json.categories[0]).id)
      }
    } catch {
      // dropdowns just stay empty; user sees the message
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
        setAmount(json.amount != null ? String(json.amount) : '')
        setDate(json.date || '')
      } else {
        setError('Couldn\u2019t read that one — type the details in by hand.')
      }
    } catch {
      setError('Couldn\u2019t read that one — type the details in by hand.')
    }
    setPhase('review')
    loadAccounts()
  }

  async function save() {
    setError('')
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter an amount.')
      return
    }
    if (!categoryId || !paidFromId) {
      setError('Pick a category and a paid-from account.')
      return
    }
    if (!fileToSave) {
      setError('Add a receipt photo first.')
      return
    }
    setPhase('saving')
    const paymentType =
      paidFrom.find((a) => a.id === paidFromId)?.paymentType || 'Cash'
    try {
      const fd = new FormData()
      fd.append('file', fileToSave)
      fd.append('vendor', vendor)
      fd.append('amount', String(amt))
      fd.append('date', date)
      fd.append('categoryId', categoryId)
      fd.append('paidFromId', paidFromId)
      fd.append('paymentType', paymentType)
      const res = await fetch('/api/receipts/save', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) {
        setPhase('review')
        setError('Couldn\u2019t save to QuickBooks. Please try again.')
        return
      }
      setResult({ attached: !!json.attached })
      setPhase('saved')
    } catch {
      setPhase('review')
      setError('Couldn\u2019t save to QuickBooks. Please try again.')
    }
  }

  const inputCls =
    'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  if (phase === 'saved') {
    return (
      <div className="card card-body space-y-3">
        <div className="flex items-center gap-2 text-foreground">
          <CheckCircle2 className="w-5 h-5 text-accent" />
          <p className="font-medium">Saved to QuickBooks</p>
        </div>
        <p className="text-sm text-muted-foreground">
          The expense was added to your books
          {result?.attached
            ? ' with the receipt photo attached.'
            : '. (The photo couldn\u2019t be attached this time, but the expense is saved.)'}
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
          <p className="text-sm font-medium text-foreground">Check and save</p>

          <label className="text-xs text-muted-foreground block">
            Vendor
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Store name"
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground block">
              Amount
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </label>
            <label className="text-xs text-muted-foreground block">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <label className="text-xs text-muted-foreground block">
            Category (what kind of expense)
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-muted-foreground block">
            Paid from
            <select
              value={paidFromId}
              onChange={(e) => setPaidFromId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choose an account</option>
              {paidFrom.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={phase === 'saving'}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 w-fit transition-colors"
          >
            {phase === 'saving' ? 'Saving\u2026' : 'Save to QuickBooks'}
          </button>
        </div>
      )}

      {phase === 'idle' && error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
