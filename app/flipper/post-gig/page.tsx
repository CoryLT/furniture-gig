'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { slugify } from '@/lib/utils'
import { X } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const FURNITURE_TYPES = [
  'Chair', 'Sofa / Couch', 'Dresser', 'Table', 'Desk', 'Bookcase',
  'Bed Frame', 'Cabinet', 'Armoire', 'Bench', 'Ottoman', 'Other',
]

const SKILL_SUGGESTIONS = [
  'Sanding', 'Painting', 'Staining', 'Upholstery', 'Woodworking',
  'Refinishing', 'Reupholstery', 'Furniture repair', 'Chalk paint',
  'Power tools', 'Hand tools', 'Distressing',
]

export default function PostGigPage() {
  const router = useRouter()
  const supabase = createClient()

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

    const { error: insertError } = await supabase
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

    if (insertError) {
      console.error('[post-gig] error:', insertError)
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/flipper/dashboard')
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-foreground">Post a Gig</h1>
        <p className="text-muted-foreground mt-1">Describe the project and what you need help with.</p>
      </div>

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

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label htmlFor="city" className="field-label">City</label>
                <input id="city" name="city" type="text" value={form.city}
                  onChange={handleChange} className="field-input" placeholder="Nashville" required />
              </div>
              <div>
                <label htmlFor="state" className="field-label">State</label>
                <select id="state" name="state" value={form.state}
                  onChange={handleChange} className="field-input" required>
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

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
                Post Gig
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
