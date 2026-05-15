'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Armchair } from 'lucide-react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

export default function FlipperOnboardingPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    username: '',
    business_name: '',
    bio: '',
    city: '',
    state: '',
    website: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Basic username validation
    if (form.username && !/^[a-z0-9_-]+$/.test(form.username)) {
      setError('Username can only contain lowercase letters, numbers, hyphens, and underscores.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/flipper-profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          <h1 className="text-2xl text-foreground">Set up your flipper profile</h1>
          <p className="text-sm text-muted-foreground">
            Tell workers a bit about you and your projects.
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
            <span className="text-xs text-muted-foreground">Post a Gig</span>
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label htmlFor="business_name" className="field-label">
                  Business / Display Name
                </label>
                <input
                  id="business_name"
                  name="business_name"
                  type="text"
                  value={form.business_name}
                  onChange={handleChange}
                  className="field-input"
                  placeholder="e.g. Nashville Flip Co."
                  required
                />
              </div>

              <div>
                <label htmlFor="username" className="field-label">
                  Username
                  <span className="text-muted-foreground font-normal ml-1">(for your public profile URL)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    flipwork.com/flippers/
                  </span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={form.username}
                    onChange={handleChange}
                    className="field-input pl-[11.5rem]"
                    placeholder="your-name"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase letters, numbers, hyphens, and underscores only.
                </p>
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
                  className="field-input min-h-[80px] resize-none"
                  placeholder="Tell workers about your business and the types of projects you post..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label htmlFor="city" className="field-label">City</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    value={form.city}
                    onChange={handleChange}
                    className="field-input"
                    placeholder="Nashville"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="state" className="field-label">State</label>
                  <select
                    id="state"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    className="field-input"
                    required
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="website" className="field-label">
                  Website
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  value={form.website}
                  onChange={handleChange}
                  className="field-input"
                  placeholder="https://yoursite.com"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                variant="accent"
                className="w-full"
                loading={loading}
              >
                Save and continue
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
