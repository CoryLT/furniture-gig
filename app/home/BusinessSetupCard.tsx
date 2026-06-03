'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Check,
  ChevronDown,
  ExternalLink,
  Briefcase,
  Pencil,
} from 'lucide-react'

type Profile = {
  business_name: string | null
  structure: string | null
  business_state: string | null
  ein: string | null
  bank_name: string | null
  bookkeeping_tool: string | null
  contractor_paperwork_ready: boolean | null
}

const STRUCTURE_LABELS: Record<string, string> = {
  sole_prop: 'Sole proprietor',
  llc: 'LLC',
  s_corp: 'S-corp',
  undecided: 'Still deciding',
}

type Field = keyof Profile

type InputDef =
  | { kind: 'text'; field: Field; label: string; placeholder?: string }
  | { kind: 'select'; field: Field; label: string; options: { value: string; label: string }[] }
  | { kind: 'check'; field: Field; label: string }

type ItemDef = {
  id: string
  title: string
  blurb: string
  link?: { href: string; text: string }
  inputs: InputDef[]
  isDone: (p: Profile) => boolean
  summary: (p: Profile) => string
}

function maskEin(ein: string | null): string {
  const digits = (ein ?? '').replace(/\D/g, '')
  return digits ? `EIN ••••${digits.slice(-4)}` : 'EIN on file'
}

const ITEMS: ItemDef[] = [
  {
    id: 'name',
    title: 'Name your business',
    blurb: "The name you operate under. Your own name is fine if you're a sole proprietor.",
    inputs: [{ kind: 'text', field: 'business_name', label: 'Business name', placeholder: 'e.g. Groovy Greens' }],
    isDone: (p) => !!(p.business_name && p.business_name.trim()),
    summary: (p) => p.business_name || '',
  },
  {
    id: 'structure',
    title: 'Choose a structure',
    blurb:
      'Sole proprietor is the simplest to start. An LLC adds a layer of liability protection. Not sure yet? Pick "Still deciding."',
    link: { href: 'https://www.sba.gov/business-guide/launch-your-business/choose-business-structure', text: 'Compare structures (SBA)' },
    inputs: [
      {
        kind: 'select',
        field: 'structure',
        label: 'Structure',
        options: [
          { value: '', label: 'Select…' },
          { value: 'sole_prop', label: 'Sole proprietor' },
          { value: 'llc', label: 'LLC' },
          { value: 's_corp', label: 'S-corp' },
          { value: 'undecided', label: 'Still deciding' },
        ],
      },
    ],
    isDone: (p) => !!p.structure && p.structure !== 'undecided',
    summary: (p) => (p.structure ? STRUCTURE_LABELS[p.structure] || p.structure : ''),
  },
  {
    id: 'state',
    title: 'Your state',
    blurb:
      'The state your business operates in. If you formed an LLC, you likely registered with that state.',
    link: { href: 'https://www.sba.gov/business-guide/launch-your-business/register-your-business', text: 'Registering your business (SBA)' },
    inputs: [{ kind: 'text', field: 'business_state', label: 'State', placeholder: 'e.g. NC' }],
    isDone: (p) => !!(p.business_state && p.business_state.trim()),
    summary: (p) => (p.business_state || '').toUpperCase(),
  },
  {
    id: 'ein',
    title: 'Get an EIN',
    blurb:
      'A free federal tax ID for your business — about 10 minutes online. A sole prop can use their SSN instead, but an EIN keeps it off the paperwork you hand out.',
    link: { href: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online', text: 'Apply for an EIN (IRS)' },
    inputs: [{ kind: 'text', field: 'ein', label: 'EIN', placeholder: 'XX-XXXXXXX' }],
    isDone: (p) => !!(p.ein && p.ein.trim()),
    summary: (p) => maskEin(p.ein),
  },
  {
    id: 'bank',
    title: 'Business bank account',
    blurb:
      'Keep business money separate from personal — it makes taxes and bookkeeping far cleaner. Just the bank name here; never your account number.',
    inputs: [{ kind: 'text', field: 'bank_name', label: 'Bank', placeholder: 'e.g. Local Credit Union' }],
    isDone: (p) => !!(p.bank_name && p.bank_name.trim()),
    summary: (p) => p.bank_name || '',
  },
  {
    id: 'books',
    title: 'Set up bookkeeping',
    blurb:
      'Track income and expenses from day one. Wave is free; QuickBooks is popular. A simple spreadsheet counts too.',
    inputs: [{ kind: 'text', field: 'bookkeeping_tool', label: 'What you use', placeholder: 'e.g. Wave, QuickBooks, Spreadsheet' }],
    isDone: (p) => !!(p.bookkeeping_tool && p.bookkeeping_tool.trim()),
    summary: (p) => p.bookkeeping_tool || '',
  },
  {
    id: 'contractor',
    title: 'Contractor paperwork',
    blurb:
      'Before you pay a worker, collect a W-9 and use a simple independent-contractor agreement. It protects you and makes your 1099s painless at tax time.',
    link: { href: 'https://www.irs.gov/pub/irs-pdf/fw9.pdf', text: 'Print the W-9 form (PDF)' },
    inputs: [{ kind: 'check', field: 'contractor_paperwork_ready', label: 'I collect W-9s and use a contractor agreement' }],
    isDone: (p) => p.contractor_paperwork_ready === true,
    summary: () => 'Ready',
  },
]

export default function BusinessSetupCard({
  userId,
  initial,
  mode = 'dashboard',
}: {
  userId: string
  initial?: Profile | null
  mode?: 'dashboard' | 'settings'
}) {
  const supabase = createClient()
  const blank: Profile = {
    business_name: null,
    structure: null,
    business_state: null,
    ein: null,
    bank_name: null,
    bookkeeping_tool: null,
    contractor_paperwork_ready: false,
  }
  const [saved, setSaved] = useState<Profile>({ ...blank, ...(initial ?? {}) })
  const [editingAll, setEditingAll] = useState(false)
  // When no initial data is passed in (the settings page), load it ourselves.
  const [loadingInitial, setLoadingInitial] = useState(initial === undefined)

  useEffect(() => {
    if (initial !== undefined) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (!cancelled) {
        if (data) setSaved((prev) => ({ ...prev, ...(data as Profile) }))
        setLoadingInitial(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doneCount = ITEMS.filter((it) => it.isDone(saved)).length
  const allDone = doneCount === ITEMS.length

  function onSaved(patch: Partial<Profile>) {
    setSaved((prev) => ({ ...prev, ...patch }))
  }

  // Still loading self-fetched data (settings page) — show nothing yet.
  if (loadingInitial) return null

  // Where this card lives depends on whether the business is set up:
  //  - dashboard: prompts until set up, then steps aside (info moves to settings)
  //  - settings:  appears only once set up, as the editable home for the info
  if (mode === 'dashboard' && allDone && !editingAll) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
        <Check className="w-4 h-4 text-accent shrink-0" />
        <span>Business set up.</span>
        <Link href="/profile" className="text-accent hover:underline">
          Manage it in Account Settings
        </Link>
      </div>
    )
  }
  if (mode === 'settings' && !allDone && !editingAll) return null

  // Completed state: business at a glance (unless they chose to edit).
  if (allDone && !editingAll) {
    return (
      <div className="card card-body space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{saved.business_name}</p>
              <p className="text-xs text-muted-foreground">Your business at a glance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingAll(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Glance label="Structure" value={saved.structure ? STRUCTURE_LABELS[saved.structure] || saved.structure : '—'} />
          <Glance label="State" value={(saved.business_state || '—').toUpperCase()} />
          <Glance label="Tax ID" value={maskEin(saved.ein)} />
          <Glance label="Bank" value={saved.bank_name || '—'} />
          <Glance label="Bookkeeping" value={saved.bookkeeping_tool || '—'} />
          <Glance label="Contractor paperwork" value="Ready ✓" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          FlipWork isn&apos;t a lawyer or accountant — confirm anything legal or tax-related with a professional.
        </p>
      </div>
    )
  }

  return (
    <div className="card card-body space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Set up your business</h2>
          <p className="text-sm text-muted-foreground">
            Work through these to get set up like a real operation. Each one saves what you enter.
          </p>
        </div>
        {allDone && (
          <button
            type="button"
            onClick={() => setEditingAll(false)}
            className="text-sm text-accent hover:underline shrink-0"
          >
            Done editing
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{doneCount} of {ITEMS.length} set up</span>
          <span>{Math.round((doneCount / ITEMS.length) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(doneCount / ITEMS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-border">
        {ITEMS.map((it) => (
          <SetupItemRow key={it.id} userId={userId} def={it} saved={saved} onSaved={onSaved} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        FlipWork isn&apos;t a lawyer or accountant — these are starting points; confirm anything legal or
        tax-related with a professional.
      </p>
    </div>
  )
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground truncate">{value}</p>
    </div>
  )
}

function SetupItemRow({
  userId,
  def,
  saved,
  onSaved,
}: {
  userId: string
  def: ItemDef
  saved: Profile
  onSaved: (patch: Partial<Profile>) => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const done = def.isDone(saved)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit() {
    // seed the draft from current saved values for this item's fields
    const seed: Partial<Profile> = {}
    for (const inp of def.inputs) (seed as any)[inp.field] = (saved as any)[inp.field]
    setDraft(seed)
    setOpen(true)
  }

  function setField(field: Field, value: any) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    const patch: any = { user_id: userId, updated_at: new Date().toISOString() }
    for (const inp of def.inputs) {
      let v: any = (draft as any)[inp.field]
      if (inp.kind === 'text') v = (v ?? '').trim() || null
      if (inp.kind === 'check') v = v === true
      patch[inp.field] = v
    }
    const { error: err } = await (supabase.from('business_profiles') as any).upsert(patch, {
      onConflict: 'user_id',
    })
    setSaving(false)
    if (err) {
      setError('Could not save. Try again.')
      return
    }
    const applied: Partial<Profile> = {}
    for (const inp of def.inputs) (applied as any)[inp.field] = patch[inp.field]
    onSaved(applied)
    setOpen(false)
    router.refresh()
  }

  // Collapsed row
  if (!open) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full flex items-center gap-3 py-3 text-left group"
      >
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
            done ? 'bg-accent border-accent text-accent-foreground' : 'border-border text-transparent'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{def.title}</span>
          {done && (
            <span className="block text-xs text-muted-foreground truncate">{def.summary(saved)}</span>
          )}
        </span>
        {done ? (
          <Pencil className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        ) : (
          <span className="text-xs text-accent shrink-0 group-hover:underline">Set up</span>
        )}
      </button>
    )
  }

  // Expanded editor
  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center shrink-0">
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </span>
        <span className="text-sm font-medium text-foreground">{def.title}</span>
      </div>

      <div className="pl-9 space-y-3">
        <p className="text-sm text-muted-foreground">{def.blurb}</p>
        {def.link && (
          <a
            href={def.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            {def.link.text}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {def.inputs.map((inp) => {
          const val = (draft as any)[inp.field]
          if (inp.kind === 'text') {
            return (
              <div key={inp.field}>
                <label className="text-xs text-muted-foreground">{inp.label}</label>
                <input
                  type="text"
                  value={val ?? ''}
                  placeholder={inp.placeholder}
                  onChange={(e) => setField(inp.field, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            )
          }
          if (inp.kind === 'select') {
            return (
              <div key={inp.field}>
                <label className="text-xs text-muted-foreground">{inp.label}</label>
                <select
                  value={val ?? ''}
                  onChange={(e) => setField(inp.field, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {inp.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          }
          // check
          return (
            <label key={inp.field} className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={val === true}
                onChange={(e) => setField(inp.field, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
              />
              <span className="text-sm text-foreground">{inp.label}</span>
            </label>
          )
        })}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <Button variant="accent" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
