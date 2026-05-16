'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Armchair, X } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const SKILL_SUGGESTIONS = [
  'Sanding', 'Painting', 'Staining', 'Upholstery', 'Woodworking',
  'Refinishing', 'Reupholstery', 'Furniture repair', 'Chalk paint',
  'Power tools', 'Hand tools', 'Distressing', 'Decoupage',
]

export default function OnboardingPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    city: '',
    state: '',
    paypal_email: '',
    username: '',
    bio: '',
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
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed])
    }
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addSkill(skillInput)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.username && !/^[a-z0-9_-]+$/.test(form.username)) {
      setError('Username can only contain lowercase letters, numbers, hyphens, and underscores.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
  ...form, 
  state: form.state,  // It's already the full name from the dropdown
  skills 
}),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to save your profile.')
        setLoading(false)
        return
      }

      router.push('/auth/agreements')
      router.refresh()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 font-serif text-2xl text-foreground">
            <Armchair className="w-6 h-6 text-accent" strokeWidth={1.5} />
            FlipWork
          </div>
          <h1 className="text-2xl text-foreground">Set up your profile</h1>
          <p className="text-sm text-muted-foreground">
            We need a few details before you can start claiming gigs.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-medium">1</div>
            <span className="text-xs font-medium text-foreground">Profile</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium">2</div>
            <span className="text-xs text-muted-foreground">Agreement</span>
          </div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium">3</div>
            <span className="text-xs text-muted-foreground">Gigs</span>
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="field-label">First name</label>
                  <input id="first_name" name="first_name" type="text" value={form.first_name}
                    onChange={handleChange} className="field-input" placeholder="Jane" required />
                </div>
                <div>
                  <label htmlFor="last_name" className="field-label">Last name</label>
                  <input id="last_name" name="last_name" type="text" value={form.last_name}
                    onChange={handleChange} className="field-input" placeholder="Smith" required />
                </div>
              </div>

              <div>
                <label htmlFor="username" className="field-label">
                  Username
                  <span className="text-muted-foreground font-normal ml-1">(for your public profile)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    flipwork.com/workers/
                  </span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={form.username}
                    onChange={handleChange}
                    className="field-input pl-[10.5rem]"
                    placeholder="your-name"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="field-label">Phone number</label>
                <input id="phone" name="phone" type="tel" value={form.phone}
                  onChange={handleChange} className="field-input" placeholder="(555) 000-0000" required />
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
                    {US_STATES.map((s) => {
  const stateNames: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  }
  const fullName = stateNames[s] || s
  return <option key={s} value={fullName}>{fullName}</option>
})}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="field-label">
                  Bio
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  className="field-input min-h-[72px] resize-none"
                  placeholder="A bit about your experience with furniture flipping..."
                />
              </div>

              <div>
                <label className="field-label">
                  Skills
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                {/* Tag suggestions */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
                {/* Added skills */}
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
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  onBlur={() => skillInput && addSkill(skillInput)}
                  className="field-input"
                  placeholder="Type a skill and press Enter..."
                />
              </div>

              <div>
                <label htmlFor="paypal_email" className="field-label">
                  PayPal email
                  <span className="text-muted-foreground font-normal ml-1">(for payments)</span>
                </label>
                <input id="paypal_email" name="paypal_email" type="email" value={form.paypal_email}
                  onChange={handleChange} className="field-input" placeholder="you@paypal.com" required />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" variant="accent" className="w-full" loading={loading}>
                Save and continue
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
