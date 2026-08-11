'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react'

// The upload screen for bank statements. Pick one or more files (Relay .csv or
// Wells Fargo .pdf), hit the button, and the server reads, sorts, and posts the
// clean lines straight into Books. We just show what happened. No approval gate.

type Summary = {
  ok: boolean
  imported: number
  autoPosted: number
  alreadyCounted: number
  needLook: number
  dismissed: number
  byBucket: Record<string, number>
  error?: string
}

const ERROR_TEXT: Record<string, string> = {
  no_file: 'Pick at least one statement file first.',
  pro_required: 'Reading PDF statements is a Pro feature. CSV statements work on any plan.',
  nothing_read: "I couldn't read any transactions out of that file. Double-check it's a statement export.",
  feed_save_failed: 'Something went wrong saving those lines. Try again in a minute.',
  unauthorized: 'Please sign in again.',
}

export default function StatementImport() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const btnCls =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'

  async function run() {
    if (files.length === 0) {
      setErr('Pick at least one statement file first.')
      return
    }
    setBusy(true)
    setErr(null)
    setResult(null)
    try {
      const fd = new FormData()
      for (const f of files) fd.append('file', f)
      const res = await fetch('/api/statements/import', { method: 'POST', body: fd })
      const data: Summary = await res.json()
      if (!res.ok || data.error) {
        setErr(ERROR_TEXT[data.error || ''] || 'Something went wrong. Please try again.')
      } else {
        setResult(data)
      }
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* File picker */}
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background px-4 py-8 text-center hover:border-accent"
      >
        <UploadCloud className="h-7 w-7 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Tap to choose your statement file(s)
        </span>
        <span className="text-xs text-muted-foreground">
          Relay CSV or Wells Fargo PDF · you can pick more than one
        </span>
        <input
          type="file"
          accept=".csv,.pdf,text/csv,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []))
            setResult(null)
            setErr(null)
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {files.map((f, i) => (
            <li key={i} className="truncate">
              • {f.name}
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={btnCls} onClick={run} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sorting…
          </>
        ) : (
          'Sort & add to my books'
        )}
      </button>

      {err && (
        <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          {err}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-5 w-5 text-accent" />
            <p className="font-semibold">Done — here&apos;s what I did</p>
          </div>

          <ul className="mt-3 space-y-1.5 text-sm text-foreground">
            <li>
              <strong>{result.autoPosted}</strong> sorted straight into your books
            </li>
            {result.alreadyCounted > 0 && (
              <li>
                <strong>{result.alreadyCounted}</strong> already-counted cash moves (sales &amp;
                ATM) — moved, not re-charged
              </li>
            )}
            {result.dismissed > 0 && (
              <li>
                <strong>{result.dismissed}</strong> tiny bank checks cancelled out
              </li>
            )}
            {result.needLook > 0 && (
              <li>
                <strong>{result.needLook}</strong> need a quick look —{' '}
                <Link href="/books/reconcile" className="font-medium text-accent hover:underline">
                  review them
                </Link>
              </li>
            )}
          </ul>

          {Object.keys(result.byBucket).length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Where they landed
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {Object.entries(result.byBucket).map(([bucket, n]) => (
                  <li key={bucket} className="flex justify-between">
                    <span>{bucket}</span>
                    <span className="text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <Link
              href="/books"
              className="text-sm font-medium text-accent hover:underline"
            >
              See it in Books →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
