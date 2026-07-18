'use client'

import { useState } from 'react'
import { Send, Loader2, Mail, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Modal-triggering button on /admin/users. Opens a preview of the
// campaign email + eligible recipient count. Only after a second
// click on "Send to N people" does anything ACTUALLY go out.
//
// After a successful send we show the sent/skipped/failed summary
// from the API so Cory can tell if anything blew up.

type PreviewResp = {
  recipientCount: number
  preview: { subject: string; html: string; text: string }
}

type SendResp = {
  success: boolean
  eligible: number
  attempted: number
  sent: number
  skipped: number
  failed: number
  truncated: boolean
  failureSample?: Array<{ email: string; reason: string }>
}

export default function CampaignSendButton() {
  const [open, setOpen] = useState(false)
  const [state, setState] =
    useState<'loading' | 'preview' | 'sending' | 'result' | 'error'>('loading')
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [result, setResult] = useState<SendResp | null>(null)
  const [error, setError] = useState('')

  async function openModal() {
    setOpen(true)
    setState('loading')
    setPreview(null)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/campaigns/free-year/preview', {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not load preview.')
        setState('error')
        return
      }
      setPreview(data as PreviewResp)
      setState('preview')
    } catch (e: any) {
      setError(e?.message || 'Network error.')
      setState('error')
    }
  }

  async function send() {
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/admin/campaigns/free-year/send', {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Send failed.')
        setState('error')
        return
      }
      setResult(data as SendResp)
      setState('result')
    } catch (e: any) {
      setError(e?.message || 'Network error.')
      setState('error')
    }
  }

  function close() {
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        onClick={openModal}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        <Mail className="w-4 h-4" />
        Send free-year offer
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-lg shadow-xl border border-border max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-accent" />
                <h2 className="font-serif text-lg text-foreground">
                  Free-year offer campaign
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5">
              {state === 'loading' && (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading preview…
                </div>
              )}

              {state === 'error' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <div>{error}</div>
                  </div>
                </div>
              )}

              {state === 'preview' && preview && (
                <PreviewBody preview={preview} />
              )}

              {state === 'sending' && (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending the campaign… don&rsquo;t close the tab.
                </div>
              )}

              {state === 'result' && result && (
                <ResultBody result={result} />
              )}
            </div>

            {/* Modal footer */}
            <div className="p-5 border-t border-border flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Emails are deduped per user + campaign, so re-clicking
                Send won&rsquo;t double-mail anyone.
              </p>
              <div className="flex gap-2">
                {state === 'result' ? (
                  <Button type="button" onClick={close}>
                    Done
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={close}
                      disabled={state === 'sending'}
                    >
                      Cancel
                    </Button>
                    {state === 'preview' && preview && (
                      <Button
                        type="button"
                        onClick={send}
                        disabled={preview.recipientCount === 0}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Send to {preview.recipientCount} {preview.recipientCount === 1 ? 'person' : 'people'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PreviewBody({ preview }: { preview: PreviewResp }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 border border-border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Recipients
        </p>
        <p className="text-3xl font-semibold text-foreground mt-1">
          {preview.recipientCount}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Excludes admins, current Pro users, and anyone who&rsquo;s
          unsubscribed or already redeemed this offer.
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          Subject line
        </p>
        <p className="text-sm text-foreground font-medium">
          {preview.subject}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          Email preview
        </p>
        <div className="border border-border rounded-md overflow-hidden">
          <iframe
            title="Email preview"
            srcDoc={preview.html}
            sandbox=""
            className="w-full bg-white"
            style={{ height: 500 }}
          />
        </div>
      </div>
    </div>
  )
}

function ResultBody({ result }: { result: SendResp }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-700">
        <CheckCircle2 className="w-5 h-5" />
        <p className="font-medium">Campaign sent</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ResultTile label="Eligible" value={result.eligible} />
        <ResultTile label="Sent" value={result.sent} tint="green" />
        <ResultTile label="Skipped" value={result.skipped} />
        <ResultTile label="Failed" value={result.failed} tint="red" />
      </div>

      {result.truncated && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          Only the first {result.attempted} were sent this run (per-run
          cap). Click Send again to continue — dedup will skip anyone
          already emailed.
        </p>
      )}

      {result.failureSample && result.failureSample.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Failure sample
          </p>
          <ul className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
            {result.failureSample.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.email}</span> — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ResultTile({
  label,
  value,
  tint,
}: {
  label: string
  value: number
  tint?: 'green' | 'red'
}) {
  const tintText =
    tint === 'green'
      ? 'text-green-700'
      : tint === 'red' && value > 0
      ? 'text-red-700'
      : 'text-foreground'
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${tintText}`}>
        {value}
      </p>
    </div>
  )
}
