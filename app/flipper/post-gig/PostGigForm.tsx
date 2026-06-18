'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { slugify } from '@/lib/utils'
import { X, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { LocationSelect } from '@/components/ui/location-select'
import GigImageUploader from '@/components/admin/GigImageUploader'
import ChecklistEditor, { ChecklistDraftItem } from '@/components/shared/ChecklistEditor'


const FURNITURE_TYPES = [
  'Chair', 'Sofa / Couch', 'Dresser', 'Chest of Drawers', 'Nightstand',
  'Table', 'Desk', 'Bookcase', 'Bed Frame', 'Cabinet', 'Armoire',
  'Bench', 'Ottoman', 'Other',
]

const SKILL_SUGGESTIONS = [
  'Sanding', 'Painting', 'Staining', 'Upholstery', 'Woodworking',
  'Refinishing', 'Reupholstery', 'Furniture repair', 'Chalk paint',
  'Power tools', 'Hand tools', 'Distressing',
]

export type ExistingDraft = { id: string; title: string }

interface Props {
  existingDraft: ExistingDraft | null
}

export default function PostGigForm({ existingDraft }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Two-step flow:
  //   step 1 = "details" — fill out the form, save the gig as a DRAFT
  //   step 2 = "photos"  — upload reference images, then publish on finish
  //
  // The gig only goes LIVE (status: 'open') when the user clicks
  // "Finish & post gig" at the end of step 2. If they refresh, close the
  // tab, or hit back during step 2 the draft stays in the database and
  // we resume it the next time they hit this page.
  const [step, setStep] = useState<'details' | 'photos'>(
    existingDraft ? 'photos' : 'details',
  )
  const [savedGigId, setSavedGigId] = useState<string | null>(
    existingDraft?.id ?? null,
  )

  const [form, setForm] = useState({
    title: '',
    furniture_type: '',
    summary: '',
    description: '',
    location_text: '',
    city: '',
    state: '',
    pay_amount: '',
    due_date: '',
  })
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [checklist, setChecklist] = useState<ChecklistDraftItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  // Whether publishing also drops a piece into the Pipeline. Default on, but we
  // remember the flipper's last choice so pipeline-skippers aren't re-nagged.
  const [addToPipeline, setAddToPipeline] = useState(true)

  useEffect(() => {
    try {
      if (localStorage.getItem('fw_add_to_pipeline') === '0') {
        setAddToPipeline(false)
      }
    } catch {}
  }, [])

  function toggleAddToPipeline(checked: boolean) {
    setAddToPipeline(checked)
    try {
      localStorage.setItem('fw_add_to_pipeline', checked ? '1' : '0')
    } catch {}
  }

  // What the flipper paid for the piece itself. Kept in form state only —
  // it's poured into the pipeline piece at publish and NEVER saved on the
  // gig, so it can't be seen by workers.
  const [pieceCost, setPieceCost] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleStateChange(state: string) {
    setForm((prev) => ({ ...prev, state, city: '' }))
  }

  function handleCityChange(city: string) {
    setForm((prev) => ({ ...prev, city }))
  }

  function addSkill(skill: string) {
    const trimmed = skill.trim()
    if (trimmed && !skills.includes(trimmed)) setSkills((prev) => [...prev, trimmed])
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  // Step 1 submit: saves the gig as a DRAFT (not live yet) so the user
  // can add photos in step 2 before publishing. Workers cannot see drafts.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated.'); setLoading(false); return }

    // Generate a unique slug
    const baseSlug = slugify(form.title)
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    const { data: newGig, error: insertError } = await supabase
      .from('gigs')
      .insert({
        title: form.title,
        slug,
        furniture_type: form.furniture_type,
        summary: form.summary,
        description: form.description,
        location_text: form.location_text || `${form.city}, ${form.state}`,
        city: form.city,
        state: form.state,
        pay_amount: parseFloat(form.pay_amount) || 0,
        required_skills: skills,
        due_date: form.due_date || null,
        status: 'draft',
        poster_user_id: user.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !newGig) {
      console.error('[post-gig] error:', insertError)
      setError(insertError?.message ?? 'Could not save the job.')
      setLoading(false)
      return
    }

    // Save checklist items (if any). We skip empty titles defensively.
    const checklistRows = checklist
      .map((item, index) => ({
        gig_id: newGig.id,
        title: item.title.trim(),
        description: item.description.trim(),
        sort_order: index,
        required: item.required,
      }))
      .filter((row) => row.title.length > 0)

    if (checklistRows.length > 0) {
      const { error: checklistError } = await supabase
        .from('gig_checklist_items')
        .insert(checklistRows)

      if (checklistError) {
        // Don't block the flow — the gig is already saved. Just log it
        // and let the flipper add the checklist later from edit.
        console.error('[post-gig] checklist insert error:', checklistError)
      }
    }

    // Draft is saved — move to the photo step. The gig is NOT visible to
    // workers yet because status='draft'.
    setSavedGigId(newGig.id)
    setStep('photos')
    setLoading(false)
  }

  // Step 2 finish: flip the draft to 'open' so workers can see it, then
  // bounce to the dashboard.
  async function handleFinish() {
    if (!savedGigId) return
    setError('')
    setPublishing(true)

    const { data: published, error: publishError } = await supabase
      .from('gigs')
      .update({ status: 'open' })
      .eq('id', savedGigId)
      .eq('status', 'draft') // safety: don't accidentally re-open an old gig
      .select('id, title, summary, pay_amount')
      .maybeSingle()

    if (publishError) {
      console.error('[post-gig] publish error:', publishError)
      setError(publishError.message ?? 'Could not publish the job.')
      setPublishing(false)
      return
    }

    // If this call actually flipped a draft to open (published is non-null),
    // drop a matching piece into the pipeline so it's tracked from day one.
    // Best-effort: a failure here must never trap the flipper on this screen.
    if (published && addToPipeline) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: newPiece } = await supabase
            .from('inventory_pieces')
            .insert({
              owner_user_id: user.id,
              source_gig_id: published.id,
              title: published.title || form.title || 'New piece',
              stage: 'sourced',
              notes: published.summary || '',
            })
            .select('id')
            .single()
          const cost = parseFloat(pieceCost) || 0
          if (newPiece?.id && cost > 0) {
            await supabase.rpc('set_piece_purchase', {
              p_piece_id: newPiece.id,
              p_amount: cost,
            })
          }
        }
      } catch (e) {
        console.error('[post-gig] pipeline auto-create failed (ignored):', e)
      }
    }

    router.push('/flipper/dashboard')
    router.refresh()
  }

  // "Start over" on the resume banner: delete the existing draft so the
  // user gets a clean slate. Cascade FKs handle checklist items and any
  // images already uploaded to the draft.
  async function handleDiscardDraft() {
    if (!savedGigId) return
    const ok = window.confirm(
      'Delete this draft and start a new job from scratch? This cannot be undone.',
    )
    if (!ok) return

    setDiscarding(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('gigs')
      .delete()
      .eq('id', savedGigId)
      .eq('status', 'draft') // safety: only delete drafts

    if (deleteError) {
      console.error('[post-gig] discard error:', deleteError)
      setError(deleteError.message ?? 'Could not delete the draft.')
      setDiscarding(false)
      return
    }

    // Reload the page so the server picks up the now-empty draft state
    // and shows a fresh step 1.
    router.refresh()
    // Belt-and-suspenders: also reset local state so we move back to step 1
    // immediately even before the server data round-trip finishes.
    setSavedGigId(null)
    setStep('details')
    setDiscarding(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">Post a Job</h1>
        <p className="text-muted-foreground mt-1">
          {step === 'details'
            ? 'Describe the project and what you need help with.'
            : 'Add reference photos so workers can see what they\u2019re bidding on.'}
        </p>
      </div>

      {/* Resume banner — only shown when we're picking up an existing draft */}
      {step === 'photos' && existingDraft && savedGigId === existingDraft.id && (
        <div className="card border-accent/40/60 bg-accent/10/50">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">
                  Picking up where you left off
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have an unfinished draft: <span className="font-medium text-foreground">{existingDraft.title || 'Untitled job'}</span>.
                  Add photos below and hit <span className="font-medium text-foreground">Finish &amp; post job</span> to make it live,
                  or start over.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/flipper/gigs/${existingDraft.id}/edit`}
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:bg-muted"
                  >
                    Edit details
                  </a>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    disabled={discarding || publishing}
                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:bg-muted disabled:opacity-50"
                  >
                    {discarding ? 'Deleting…' : 'Start over (delete draft)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-2 ${step === 'details' ? 'text-foreground' : 'text-muted-foreground'}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
            ${step === 'details'
              ? 'bg-accent text-accent-foreground'
              : 'bg-muted text-muted-foreground'}`}>
            {step === 'photos' ? <Check className="h-4 w-4" /> : '1'}
          </div>
          <span>Job details</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${step === 'photos' ? 'text-foreground' : 'text-muted-foreground'}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
            ${step === 'photos'
              ? 'bg-accent text-accent-foreground'
              : 'bg-muted text-muted-foreground'}`}>
            2
          </div>
          <span>Photos</span>
        </div>
      </div>

      {step === 'details' && (
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label htmlFor="title" className="field-label">Gig Title</label>
                <input id="title" name="title" type="text" value={form.title}
                  onChange={handleChange} className="field-input"
                  placeholder="e.g. Sand and repaint vintage dresser" required />
              </div>

              <div>
                <label htmlFor="furniture_type" className="field-label">Furniture Type</label>
                <select id="furniture_type" name="furniture_type" value={form.furniture_type}
                  onChange={handleChange} className="field-input" required>
                  <option value="">Select type...</option>
                  {FURNITURE_TYPES.map((t) => (
                    <option key={t} value={t.toLowerCase()}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="summary" className="field-label">
                  Short Summary
                  <span className="text-muted-foreground font-normal ml-1">(shown on gig cards)</span>
                </label>
                <input id="summary" name="summary" type="text" value={form.summary}
                  onChange={handleChange} className="field-input"
                  placeholder="One sentence overview of the project" required />
              </div>

              <ChecklistEditor
                items={checklist}
                onChange={setChecklist}
                disabled={loading}
              />

              <div>
                <label htmlFor="description" className="field-label">Full Description</label>
                <textarea id="description" name="description" value={form.description}
                  onChange={handleChange} className="field-input min-h-[120px] resize-none"
                  placeholder="Describe the job — what needs doing, the condition of anything involved, and any details that matter..."
                  required />
              </div>

              <LocationSelect
                selectedState={form.state}
                selectedCity={form.city}
                onStateChange={handleStateChange}
                onCityChange={handleCityChange}
                disabled={loading}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pay_amount" className="field-label">Pay Amount ($)</label>
                  <input id="pay_amount" name="pay_amount" type="number" value={form.pay_amount}
                    onChange={handleChange} className="field-input" placeholder="0.00"
                    min="0" step="0.01" required />
                </div>
                <div>
                  <label htmlFor="due_date" className="field-label">
                    Due Date
                    <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                  </label>
                  <input id="due_date" name="due_date" type="date" value={form.due_date}
                    onChange={handleChange} className="field-input" />
                </div>
              </div>

              <div>
                <label className="field-label">
                  Required Skills
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
                    <button key={s} type="button" onClick={() => addSkill(s)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors">
                      + {s}
                    </button>
                  ))}
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {skills.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                        {s}
                        <button type="button" onClick={() => removeSkill(s)} className="hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput) } }}
                  onBlur={() => skillInput && addSkill(skillInput)}
                  className="field-input" placeholder="Type a skill and press Enter..." />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1"
                  onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" className="flex-1" loading={loading}>
                  Save & continue
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {step === 'photos' && savedGigId && (
        <div className="space-y-4">
          <GigImageUploader
            gigId={savedGigId}
            images={[]}
            onImagesChange={() => {}}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none pt-2">
            <input
              type="checkbox"
              checked={addToPipeline}
              onChange={(e) => toggleAddToPipeline(e.target.checked)}
              className="mt-0.5 rounded border-border accent-accent"
            />
            <span>
              <span className="font-medium text-foreground">Add this to my Pipeline</span>
              <span className="block text-muted-foreground text-xs">
                Creates a piece in your Pipeline to track this from sourced through to sold.
              </span>
            </span>
          </label>

          {addToPipeline && (
            <div className="pl-7">
              <label className="block text-sm text-foreground mb-1">
                What you paid for the piece{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="relative max-w-[170px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={pieceCost}
                  onChange={(e) => setPieceCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Only you see this — it&apos;s added to the piece&apos;s cost in your Pipeline and never shown to workers.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Photos save as soon as they upload. Your job isn&apos;t live until you hit Finish &amp; post.
            </p>
            <Button
              type="button"
              variant="accent"
              loading={publishing}
              disabled={discarding}
              onClick={handleFinish}
            >
              Finish & post job
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
