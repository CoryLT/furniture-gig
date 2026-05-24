'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { slugify } from '@/lib/utils'
import { X, ChevronRight, Check } from 'lucide-react'
import { LocationSelect } from '@/components/ui/location-select'
import GigImageUploader from '@/components/admin/GigImageUploader'


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

export default function PostGigForm() {
  const router = useRouter()
  const supabase = createClient()

  // Two-step flow:
  //   step 1 = "details" — fill out the form, save the gig
  //   step 2 = "photos"  — upload reference images for the saved gig
  const [step, setStep] = useState<'details' | 'photos'>('details')
  const [savedGigId, setSavedGigId] = useState<string | null>(null)

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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
        status: 'open',
        poster_user_id: user.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !newGig) {
      console.error('[post-gig] error:', insertError)
      setError(insertError?.message ?? 'Could not save the gig.')
      setLoading(false)
      return
    }

    // Gig is saved — move to the photo step so they can add reference images.
    setSavedGigId(newGig.id)
    setStep('photos')
    setLoading(false)
  }

  function handleFinish() {
    router.push('/flipper/dashboard')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">Post a Gig</h1>
        <p className="text-muted-foreground mt-1">
          {step === 'details'
            ? 'Describe the project and what you need help with.'
            : 'Add reference photos so workers can see what they\u2019re bidding on.'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-2 ${step === 'details' ? 'text-foreground' : 'text-muted-foreground'}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
            ${step === 'details'
              ? 'bg-accent text-accent-foreground'
              : 'bg-stone-100 text-muted-foreground'}`}>
            {step === 'photos' ? <Check className="h-4 w-4" /> : '1'}
          </div>
          <span>Gig details</span>
        </div>
        <ChevronRight className="h-4 w-4 text-stone-300" />
        <div className={`flex items-center gap-2 ${step === 'photos' ? 'text-foreground' : 'text-muted-foreground'}`}>
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
            ${step === 'photos'
              ? 'bg-accent text-accent-foreground'
              : 'bg-stone-100 text-muted-foreground'}`}>
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

              <div>
                <label htmlFor="description" className="field-label">Full Description</label>
                <textarea id="description" name="description" value={form.description}
                  onChange={handleChange} className="field-input min-h-[120px] resize-none"
                  placeholder="Describe the furniture, condition, what needs to be done, any special requirements..."
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Photos save as soon as they upload. You can skip this and add photos later.
            </p>
            <Button type="button" variant="accent" onClick={handleFinish}>
              Finish & post gig
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
