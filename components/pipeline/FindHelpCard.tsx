'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

// The saved shape of a piece's "Find help" ad. All optional so a
// half-filled draft still saves and reopens.
export type HelpAd = {
  what?: string
  pay?: string
  area?: string
  timeline?: string
  apply?: 'reply' | 'phone'
  phone?: string
  updated_at?: string
}

// Turn the answers into a plain-text ad that pastes cleanly onto
// Craigslist or Facebook (both are plain text — no clickable buttons).
export function buildAdText(pieceTitle: string, ad: HelpAd): string {
  const lines: string[] = []
  const headline = ad.what?.trim()
    ? `Help wanted — ${ad.what.trim()}`
    : 'Help wanted'
  lines.push(headline)
  lines.push('')

  if (pieceTitle.trim()) lines.push(`Project: ${pieceTitle.trim()}`)
  if (ad.what?.trim()) lines.push(`What I need: ${ad.what.trim()}`)
  if (ad.pay?.trim()) lines.push(`Pay: ${ad.pay.trim()}`)
  if (ad.area?.trim()) lines.push(`Location: ${ad.area.trim()}`)
  if (ad.timeline?.trim()) lines.push(`Timeline: ${ad.timeline.trim()}`)

  lines.push('')
  if (ad.apply === 'phone' && ad.phone?.trim()) {
    lines.push(`To apply: text or call ${ad.phone.trim()}.`)
  } else {
    lines.push('To apply: reply to this post.')
  }

  return lines.join('\n').trim()
}

export default function FindHelpCard({
  pieceTitle,
  initial,
  onSave,
}: {
  pieceTitle: string
  initial: HelpAd | null
  onSave: (ad: HelpAd) => Promise<boolean>
}) {
  const [what, setWhat] = useState(initial?.what ?? '')
  const [pay, setPay] = useState(initial?.pay ?? '')
  const [area, setArea] = useState(initial?.area ?? '')
  const [timeline, setTimeline] = useState(initial?.timeline ?? '')
  const [apply, setApply] = useState<'reply' | 'phone'>(initial?.apply ?? 'reply')
  const [phone, setPhone] = useState(initial?.phone ?? '')

  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const ad: HelpAd = { what, pay, area, timeline, apply, phone }
  const adText = buildAdText(pieceTitle, ad)
  // Enough to bother saving/copying once they've said what they need.
  const hasSomething = what.trim().length > 0

  async function copy() {
    try {
      await navigator.clipboard.writeText(adText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setSavedMsg('Copy didn\u2019t work \u2014 select the text and copy it by hand.')
    }
  }

  async function save() {
    setSaving(true)
    setSavedMsg('')
    const ok = await onSave({ ...ad, updated_at: new Date().toISOString() })
    setSaving(false)
    setSavedMsg(ok ? 'Saved. This ad will be here next time.' : 'Could not save. Try again.')
  }

  const fieldClass =
    'w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30'

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">Find help</p>
        <p className="text-xs text-muted-foreground">
          Answer a few questions and we&apos;ll write an ad you can paste on Craigslist or Facebook.
        </p>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">What needs doing?</label>
          <input
            type="text"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="e.g. sand, paint, and new hardware"
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Pay</label>
            <input
              type="text"
              value={pay}
              onChange={(e) => setPay(e.target.value)}
              placeholder="e.g. $80"
              className={fieldClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">When</label>
            <input
              type="text"
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              placeholder="e.g. this week"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Area</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. Charlotte, NC"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">How should people reach you?</label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setApply('reply')}
              className={`flex-1 rounded-lg border px-2.5 py-2 text-sm transition ${
                apply === 'reply'
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              Reply where you posted
            </button>
            <button
              type="button"
              onClick={() => setApply('phone')}
              className={`flex-1 rounded-lg border px-2.5 py-2 text-sm transition ${
                apply === 'phone'
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              Text/call me
            </button>
          </div>
          {apply === 'phone' && (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your phone number"
              className={`${fieldClass} mt-1.5`}
            />
          )}
        </div>
      </div>

      {/* Live preview of the ad */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Your ad</p>
          <button
            type="button"
            onClick={copy}
            disabled={!hasSomething}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground font-sans">
          {hasSomething ? adText : 'Fill in what needs doing to see your ad here.'}
        </pre>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="accent" onClick={save} disabled={saving || !hasSomething}>
          {saving ? 'Saving\u2026' : 'Save ad'}
        </Button>
        {savedMsg && <p className="text-xs text-muted-foreground">{savedMsg}</p>}
      </div>
    </div>
  )
}
