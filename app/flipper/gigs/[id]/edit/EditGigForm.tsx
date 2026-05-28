'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import type { GigRow, GigImageRow } from '@/types/database'
import GigImageUploader from '@/components/admin/GigImageUploader'
import { LocationSelect } from '@/components/ui/location-select'
import ConfirmActionModal from '@/components/shared/ConfirmActionModal'
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

interface Props {
  gig: GigRow
  hasActiveClaim: boolean
  images: GigImageRow[]
  initialChecklist: ChecklistDraftItem[]
}

export default function EditGigForm({ gig, hasActiveClaim, images, initialChecklist }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    title: gig.title,
    furniture_type: gig.furniture_type,
    summary: gig.summary,
    description: gig.description,
    location_text: gig.location_text,
    city: gig.city,
    state: gig.state,
    pay_amount: gig.pay_amount.toString(),
    due_date: gig.due_date ?? '',
  })
  const [skills, setSkills] = useState<string[]>(gig.required_skills ?? [])
  const [skillInput, setSkillInput] = useState('')
  const [checklist, setChecklist] = useState<ChecklistDraftItem[]>(initialChecklist)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleStateChange(state: string) {
    // When the state changes, reset the city (the city list depends on the state).
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: updateError } = await supabase
      .from('gigs')
      .update({
        title: form.title,
        furniture_type: form.furniture_type,
        summary: form.summary,
        description: form.description,
        location_text: form.location_text || `${form.city}, ${form.state}`,
        city: form.city,
        state: form.state,
        pay_amount: parseFloat(form.pay_amount) || 0,
        required_skills: skills,
        due_date: form.due_date || null,
      })
      .eq('id', gig.id)

    if (updateError) {
      console.error('[edit-gig] error:', updateError)
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Sync checklist items. Strategy is simple and safe:
    //   1. Delete every existing item for this gig
    //   2. Insert the current editor state as fresh rows
    // This avoids fiddly per-row diffing. It's safe because completions
    // are tied to checklist_item_id, but those rows live in
    // gig_task_completions and are only created when a worker checks
    // off a step. If a flipper edits the checklist mid-claim, any
    // existing completions for the old items get orphaned — that's
    // acceptable for now (only the flipper can edit, and they own
    // their gig).
    const { error: deleteError } = await supabase
      .from('gig_checklist_items')
      .delete()
      .eq('gig_id', gig.id)

    if (deleteError) {
      console.error('[edit-gig] checklist delete error:', deleteError)
      setError('Could not update the checklist. Try again.')
      setLoading(false)
      return
    }

    const checklistRows = checklist
      .map((item, index) => ({
        gig_id: gig.id,
        title: item.title.trim(),
        description: item.description.trim(),
        sort_order: index,
        required: item.required,
      }))
      .filter((row) => row.title.length > 0)

    if (checklistRows.length > 0) {
      const { error: insertError } = await supabase
        .from('gig_checklist_items')
        .insert(checklistRows)

      if (insertError) {
        console.error('[edit-gig] checklist insert error:', insertError)
        setError('Could not save the checklist. Try again.')
        setLoading(false)
        return
      }
    }

    router.push(`/flipper/gigs/${gig.id}`)
    router.refresh()
  }

  async function handleArchive() {
    setError('')
    setArchiving(true)

    const { error: archiveError } = await supabase
      .from('gigs')
      .update({ status: 'archived' })
      .eq('id', gig.id)

    if (archiveError) {
      console.error('[edit-gig] archive error:', archiveError)
      setError(archiveError.message)
      setArchiving(false)
      setArchiveOpen(false)
      return
    }

    setArchiveOpen(false)
    router.push('/flipper/dashboard')
    router.refresh()
  }

  async function handleDelete() {
    setError('')
    setDeleting(true)

    try {
      const res = await fetch(`/api/gigs/${gig.id}/delete`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(body?.error || 'Could not delete gig.')
        setDeleting(false)
        return
      }

      setDeleteOpen(false)
      router.push('/flipper/dashboard')
      router.refresh()
    } catch (e) {
      console.error('[edit-gig] delete error:', e)
      setError('Could not delete gig. Try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">Edit gig</h1>
        <p className="text-muted-foreground mt-1">Update the project details or take the gig down.</p>
      </div>

      {/* Warning banner if a worker has already claimed the gig */}
      {hasActiveClaim && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">A worker has already claimed this gig.</p>
            <p className="mt-0.5">
              Big changes to the price, scope, or due date might confuse them. Consider messaging them
              before you save edits.
            </p>
          </div>
        </div>
      )}

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
                placeholder="Describe the gig — what needs doing, the condition of anything involved, and any details that matter..."
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
                onClick={() => router.push(`/flipper/gigs/${gig.id}`)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" className="flex-1" loading={loading}>
                Save changes
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Photos section — saved automatically as you upload */}
      <GigImageUploader gigId={gig.id} images={images} onImagesChange={() => {}} />

      {/* Danger zone — separated visually from the main form */}
      <div className="card border-destructive/30">
        <div className="card-body space-y-5">
          {gig.status !== 'archived' && (
            <div className="space-y-3">
              <div>
                <h2 className="font-sans font-semibold text-foreground">Archive this gig</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hides the gig from workers and from your dashboard.
                  Existing claims, photos, and history are kept.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setArchiveOpen(true)}
                loading={archiving}
                className="text-destructive hover:bg-destructive/5 border-destructive/30"
              >
                Archive this gig
              </Button>
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-5">
            <div>
              <h2 className="font-sans font-semibold text-foreground">Delete this gig</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently removes the gig and everything tied to it (claims,
                checklist, photos, messages). This cannot be undone. If money
                has already moved on this gig, use Archive instead.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              loading={deleting}
            >
              Delete this gig permanently
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation modals */}
      <ConfirmActionModal
        open={archiveOpen}
        title="Archive this gig?"
        description="It will be hidden from workers and from your dashboard. Claims and history are kept. You can't unarchive from the app yet."
        confirmLabel="Yes, archive"
        confirmVariant="destructive"
        loading={archiving}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />

      <ConfirmActionModal
        open={deleteOpen}
        title="Delete this gig permanently?"
        description={
          'This removes the gig and every claim, photo, checklist item, ' +
          'message, and payout record attached to it.\n\nThis cannot be undone.'
        }
        typeToConfirm="DELETE"
        confirmLabel="Delete permanently"
        confirmVariant="destructive"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
