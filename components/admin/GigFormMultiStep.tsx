'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import GigImageUploader from './GigImageUploader'
import { slugify } from '@/lib/utils'
import { Plus, X, ChevronRight } from 'lucide-react'
import { CITIES_BY_STATE, US_STATES } from '@/lib/locationData'
import type { GigRow, GigChecklistItemRow, GigImageRow } from '@/types/database'

interface Props {
  gig?: GigRow
  checklist?: GigChecklistItemRow[]
  images?: GigImageRow[]
  initialImages?: GigImageRow[]
  mode: 'create' | 'edit'
}

export default function GigFormMultiStep({
  gig,
  checklist: initialChecklist,
  images: initialImages,
  mode,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'details' | 'images' | 'review'>('details')
  const [savedGigId, setSavedGigId] = useState<string | null>(gig?.id ?? null)

  const [title, setTitle] = useState(gig?.title ?? '')
  const [summary, setSummary] = useState(gig?.summary ?? '')
  const [description, setDescription] = useState(gig?.description ?? '')
  const [furnitureType, setFurnitureType] = useState(gig?.furniture_type ?? '')
  const [selectedState, setSelectedState] = useState(gig?.location_text?.split(', ')[1] ?? '')
  const [selectedCity, setSelectedCity] = useState(gig?.location_text?.split(', ')[0] ?? '')
  const [payAmount, setPayAmount] = useState(gig?.pay_amount ?? '')
  const [requiredSkills, setRequiredSkills] = useState(gig?.required_skills ?? '')
  const [dueDate, setDueDate] = useState(gig?.due_date ?? '')
  const [status, setStatus] = useState(gig?.status ?? 'draft')

  const [checklist, setChecklist] = useState<Array<GigChecklistItemRow & { _isNew?: boolean }>>(initialChecklist ?? [])
  const [newChecklistItem, setNewChecklistItem] = useState('')

  const availableCities = selectedState ? CITIES_BY_STATE[selectedState as keyof typeof CITIES_BY_STATE] || [] : []

  const handleStateChange = (newState: string) => {
    setSelectedState(newState)
    setSelectedCity('')
  }

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return
    const newItem = {
      id: `temp_${Date.now()}`,
      gig_id: savedGigId || '',
      title: newChecklistItem,
      description: '',
      sort_order: checklist.length,
      required: true,
      _isNew: true,
    } as GigChecklistItemRow & { _isNew?: boolean }
    setChecklist([...checklist, newItem])
    setNewChecklistItem('')
  }

  const updateChecklistItem = (id: string, field: string, value: any) => {
    setChecklist(checklist.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id))
  }

  const handleNextFromDetails = async () => {
    if (!title || !summary || !selectedCity || !selectedState || !payAmount) {
      alert('Please fill in all required fields')
      return
    }

    if (!savedGigId) {
      const slug = slugify(title)
      const { data, error } = await supabase
        .from('gigs')
        .insert({
          title,
          slug,
          summary,
          description,
          furniture_type: furnitureType,
          location_text: `${selectedCity}, ${selectedState}`,
          pay_amount: parseFloat(payAmount),
          required_skills: requiredSkills,
          due_date: dueDate,
          status: mode === 'create' ? 'draft' : status,
        })
        .select()
        .single()

      if (error) {
        alert('Error saving gig: ' + error.message)
        return
      }

      setSavedGigId(data.id)

      if (checklist.length > 0) {
        const itemsToInsert = checklist.map((item, idx) => ({
          gig_id: data.id,
          title: item.title,
          description: item.description || '',
          sort_order: idx,
          required: item.required,
        }))

        const { error: checklistError } = await supabase
          .from('gig_checklist_items')
          .insert(itemsToInsert)

        if (checklistError) {
          console.error('Error saving checklist:', checklistError)
        }
      }
    } else {
      const { error } = await supabase
        .from('gigs')
        .update({
          title,
          summary,
          description,
          furniture_type: furnitureType,
          location_text: `${selectedCity}, ${selectedState}`,
          pay_amount: parseFloat(payAmount),
          required_skills: requiredSkills,
          due_date: dueDate,
          status,
        })
        .eq('id', savedGigId)

      if (error) {
        alert('Error updating gig: ' + error.message)
        return
      }

      const newItems = checklist.filter((item) => item._isNew)
      if (newItems.length > 0) {
        const itemsToInsert = newItems.map((item, idx) => ({
          gig_id: savedGigId,
          title: item.title,
          description: item.description || '',
          sort_order: checklist.indexOf(item),
          required: item.required,
        }))

        const { error: checklistError } = await supabase
          .from('gig_checklist_items')
          .insert(itemsToInsert)

        if (checklistError) {
          console.error('Error saving checklist:', checklistError)
        }
      }
    }

    setStep('images')
  }

  const handleSubmit = async () => {
    if (savedGigId) {
      const { error } = await supabase
        .from('gigs')
        .update({ status: mode === 'create' ? 'open' : status })
        .eq('id', savedGigId)

      if (error) {
        alert('Error publishing gig: ' + error.message)
        return
      }
    }

    router.push('/admin/gigs')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step === 'details' ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-700'}`}>1</div>
        <ChevronRight className="h-4 w-4 text-stone-300" />
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step === 'images' ? 'bg-amber-500 text-white' : step === 'review' ? 'bg-stone-200 text-stone-700' : 'bg-stone-100 text-stone-400'}`}>2</div>
        <ChevronRight className="h-4 w-4 text-stone-300" />
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step === 'review' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'}`}>3</div>
      </div>

      {step === 'details' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Gig Details</h2>

          <div>
            <label className="block text-sm font-medium text-stone-700">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" placeholder="e.g., Refinish Oak Dresser" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Summary</label>
            <input type="text" value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" placeholder="Brief 1-line description" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" placeholder="Detailed instructions for the worker" rows={4} />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Furniture Type</label>
            <input type="text" value={furnitureType} onChange={(e) => setFurnitureType(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" placeholder="e.g., Dresser, Couch, Table" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">State</label>
            <select value={selectedState} onChange={(e) => handleStateChange(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900">
              <option value="">Select a state</option>
              {US_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">City</label>
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} disabled={!selectedState} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900 disabled:bg-stone-100 disabled:text-stone-500">
              <option value="">{selectedState ? 'Select a city' : 'Select a state first'}</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Pay Amount ($)</label>
            <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" placeholder="0.00" step="0.01" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Required Skills</label>
            <input type="text" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" placeholder="e.g., Sanding, Painting, Upholstery" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900" />
          </div>

          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-stone-700">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="mt-1 block w-full rounded border border-stone-300 px-3 py-2 text-stone-900">
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="claimed">Claimed</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}

          <div className="border-t border-stone-200 pt-4">
            <h3 className="text-sm font-medium text-stone-700">Checklist</h3>
            <div className="mt-2 space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <input type="text" value={item.title} onChange={(e) => updateChecklistItem(item.id, 'title', e.target.value)} className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm" />
                  <button onClick={() => removeChecklistItem(item.id)} className="p-1 hover:bg-red-100"><X className="h-4 w-4 text-red-600" /></button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <input type="text" value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()} className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm" placeholder="Add checklist item" />
              <button onClick={addChecklistItem} className="flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-sm text-white hover:bg-amber-600"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          <Button onClick={handleNextFromDetails} className="w-full">Next: Upload Photos</Button>
        </div>
      )}

      {step === 'images' && savedGigId && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Gig Photos</h2>
          <GigImageUploader gigId={savedGigId} initialImages={initialImages} mode={mode} />

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('details')} className="flex-1">Back</Button>
            <Button onClick={() => setStep('review')} className="flex-1">Next: Review</Button>
          </div>
        </div>
      )}

      {step === 'review' && savedGigId && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Review & Publish</h2>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-2 text-sm">
            <div><span className="font-medium">Title:</span> {title}</div>
            <div><span className="font-medium">Location:</span> {selectedCity}, {selectedState}</div>
            <div><span className="font-medium">Pay:</span> ${payAmount}</div>
            <div><span className="font-medium">Status:</span> {status}</div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('images')} className="flex-1">Back</Button>
            <Button onClick={handleSubmit} className="flex-1">{mode === 'create' ? 'Publish Gig' : 'Save Changes'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}