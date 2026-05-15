'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import GigImageUploader from './GigImageUploader'
import { slugify } from '@/lib/utils'
import { Plus, X } from 'lucide-react'
import type { GigRow, GigChecklistItemRow, GigImageRow } from '@/types/database'

interface Props {
  gig?: GigRow
  checklist?: GigChecklistItemRow[]
  images?: GigImageRow[]
  mode: 'create' | 'edit'
}

interface ChecklistItem {
  id?: string
  title: string
  description: string
  required: boolean
  sort_order: number
}

export default function GigForm({ gig, checklist: initialChecklist, images: initialImages, mode }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    title: gig?.title ?? '',
    summary: gig?.summary ?? '',
    description: gig?.description ?? '',
    furniture_type: gig?.furniture_type ?? '',
    location_text: gig?.location_text ?? '',
    pay_amount: gig?.pay_amount?.toString() ?? '',
    due_date: gig?.due_date ?? '',
    status: gig?.status ?? 'draft',
    required_skills: gig?.required_skills?.join(', ') ?? '',
  })

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initialChecklist?.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      required: i.required,
      sort_order: i.sort_order,
    })) ?? []
  )

  const [images, setImages] = useState<GigImageRow[]>(initialImages ?? [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function addChecklistItem() {
    setChecklist((prev) => [
      ...prev,
      { title: '', description: '', required: true, sort_order: prev.length },
    ])
  }

  function updateChecklistItem(index: number, field: keyof ChecklistItem, value: string | boolean | number) {
    setChecklist((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function removeChecklistItem(index: number) {
    setChecklist((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const skills = form.required_skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const gigData = {
      title: form.title,
      slug: mode === 'create' ? slugify(form.title) : gig!.slug,
      summary: form.summary,
      description: form.description,
      furniture_type: form.furniture_type,
      location_text: form.location_text,
      pay_amount: parseFloat(form.pay_amount) || 0,
      due_date: form.due_date || null,
      status: form.status as GigRow['status'],
      required_skills: skills,
    }

    let gigId = gig?.id

    if (mode === 'create') {
      const { data: newGig, error: createError } = await supabase
        .from('gigs')
        .insert(gigData)
        .select()
        .single()

      if (createError || !newGig) {
        setError(createError?.message ?? 'Failed to create gig.')
        setLoading(false)
        return
      }
      gigId = newGig.id
    } else {
      const { error: updateError } = await supabase
        .from('gigs')
        .update(gigData)
        .eq('id', gig!.id)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }
    }

    // Sync checklist
    if (gigId) {
      if (mode === 'edit') {
        // Delete removed items
        const keepIds = checklist.filter((i) => i.id).map((i) => i.id!)
        if (initialChecklist) {
          const toDelete = initialChecklist
            .filter((i) => !keepIds.includes(i.id))
            .map((i) => i.id)
          if (toDelete.length > 0) {
            await supabase.from('gig_checklist_items').delete().in('id', toDelete)
          }
        }
      }

      for (let i = 0; i < checklist.length; i++) {
        const item = checklist[i]
        if (item.id) {
          await supabase
            .from('gig_checklist_items')
            .update({ title: item.title, description: item.description, required: item.required, sort_order: i })
            .eq('id', item.id)
        } else {
          await supabase
            .from('gig_checklist_items')
            .insert({ gig_id: gigId, title: item.title, description: item.description, required: item.required, sort_order: i })
        }
      }
    }

    router.push('/admin/gigs')
    router.refresh()
  }

  const GIG_STATUSES: GigRow['status'][] = ['draft', 'open', 'claimed', 'in_review', 'completed', 'archived']

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Basic info */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-sans font-semibold text-foreground">Gig details</h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="field-label">Title *</label>
            <input name="title" value={form.title} onChange={handleChange} className="field-input" required placeholder="Refinish dining table" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Furniture type</label>
              <input name="furniture_type" value={form.furniture_type} onChange={handleChange} className="field-input" placeholder="table, chair, dresser…" />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="field-input">
                {GIG_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Summary <span className="font-normal text-muted-foreground">(shown on card)</span></label>
            <input name="summary" value={form.summary} onChange={handleChange} className="field-input" placeholder="Brief one-liner for the gig board" />
          </div>

          <div>
            <label className="field-label">Full description</label>
            <textarea name="description" value={form.description} onChange={handleChange} className="field-input resize-none h-32" placeholder="Detailed description, materials, expectations…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Location</label>
              <input name="location_text" value={form.location_text} onChange={handleChange} className="field-input" placeholder="Nashville, TN" />
            </div>
            <div>
              <label className="field-label">Pay amount ($)</label>
              <input name="pay_amount" type="number" step="0.01" min="0" value={form.pay_amount} onChange={handleChange} className="field-input" placeholder="150" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Due date</label>
              <input name="due_date" type="date" value={form.due_date} onChange={handleChange} className="field-input" />
            </div>
            <div>
              <label className="field-label">Required skills <span className="font-normal text-muted-foreground">(comma-separated)</span></label>
              <input name="required_skills" value={form.required_skills} onChange={handleChange} className="field-input" placeholder="sanding, painting, staining" />
            </div>
          </div>
        </div>
      </div>

      {/* Image uploader */}
      {mode === 'edit' && gig && (
        <GigImageUploader gigId={gig.id} images={images} onImagesChange={setImages} />
      )}

      {/* Checklist builder */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-sans font-semibold text-foreground">Checklist</h2>
          <Button type="button" variant="ghost" size="sm" onClick={addChecklistItem} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add item
          </Button>
        </div>
        <div className="divide-y divide-border">
          {checklist.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No checklist items yet. Add items workers must complete.
            </div>
          )}
          {checklist.map((item, index) => (
            <div key={index} className="px-6 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0 mt-2">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <input
                    value={item.title}
                    onChange={(e) => updateChecklistItem(index, 'title', e.target.value)}
                    className="field-input"
                    placeholder="Step title"
                    required
                  />
                  <input
                    value={item.description}
                    onChange={(e) => updateChecklistItem(index, 'description', e.target.value)}
                    className="field-input text-xs"
                    placeholder="Optional description…"
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => updateChecklistItem(index, 'required', e.target.checked)}
                      className="accent-accent"
                    />
                    Required
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeChecklistItem(index)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors mt-2 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" variant="accent" loading={loading}>
          {mode === 'create' ? 'Create gig' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/gigs')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
