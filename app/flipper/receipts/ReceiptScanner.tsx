'use client'

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'

export default function ReceiptScanner() {
  const [phase, setPhase] = useState<'idle' | 'reading' | 'review' | 'error'>('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

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
      // fall back to the original
    }

    try {
      const fd = new FormData()
      fd.append('file', toSend)
      const res = await fetch('/api/receipts/scan', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) {
        setPhase('error')
        setError('Could not read that receipt. You can type the details in by hand.')
        return
      }
      setVendor(json.vendor || '')
      setAmount(json.amount != null ? String(json.amount) : '')
      setDate(json.date || '')
      setPhase('review')
    } catch {
      setPhase('error')
      setError('Could not read that receipt. You can type the details in by hand.')
    }
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
            disabled={phase === 'reading'}
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
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {(phase === 'review' || phase === 'error') && (
        <div className="card card-body space-y-3">
          <p className="text-sm font-medium text-foreground">Check what we read</p>
          <label className="text-xs text-muted-foreground block">
            Vendor
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Store name"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
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
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <label className="text-xs text-muted-foreground block">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Next step will send this to QuickBooks with the photo attached.
          </p>
        </div>
      )}
    </div>
  )
}
