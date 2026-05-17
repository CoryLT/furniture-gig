'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function WorkerProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    phone: '',
    city: '',
    state: '',
    bio: '',
    skills: [] as string[],
    paypal_email: '',
    avatar_url: '',
  })

  const [skillInput, setSkillInput] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/auth/login')
      return
    }

    setUser(user)

    const { data: profileData } = await supabase
      .from('worker_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setForm({
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        username: profileData.username || '',
        phone: profileData.phone || '',
        city: profileData.city || '',
        state: profileData.state || '',
        bio: profileData.bio || '',
        skills: profileData.skills || [],
        paypal_email: profileData.paypal_email || '',
        avatar_url: profileData.avatar_url || '',
      })
    }
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function addSkill(skill: string) {
    const trimmed = skill.trim()
    if (trimmed && !form.skills.includes(trimmed)) {
      setForm({ ...form, skills: [...form.skills, trimmed] })
    }
    setSkillInput('')
  }

  function removeSkill(skill: string) {
    setForm({ ...form, skills: form.skills.filter(s => s !== skill) })
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `worker-avatars/${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    setForm({ ...form, avatar_url: urlData.publicUrl })
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.first_name || !form.last_name || !form.username) {
      setError('First name, last name, and username are required')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/profile/save', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        setError('Failed to save profile: ' + (data.error || 'Unknown error'))
      } else {
        setSuccess('Profile saved successfully!')
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }

    setLoading(false)
  }

  if (loading && !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/gigs" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to gigs
        </Link>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Your Profile</h1>
            <p className="text-muted-foreground mt-1">Edit your worker profile</p>
          </div>

          <div className="card">
            <div className="card-body space-y-6">
              {/* Avatar upload */}
              <div>
                <label className="field-label">Profile Picture</label>
                <div className="flex items-end gap-4">
                  {form.avatar_url && (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-stone-200">
                      <Image
                        src={form.avatar_url}
                        alt="Avatar"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label htmlFor="avatar-upload">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading}
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                        className="gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Upload photo
                      </Button>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">Max 5MB</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first_name" className="field-label">First name</label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={handleChange}
                      className="field-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="last_name" className="field-label">Last name</label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={handleChange}
                      className="field-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="username" className="field-label">Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={form.username}
                    onChange={handleChange}
                    className="field-input"
                    placeholder="your-username"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your public profile URL: flipwork.com/workers/{form.username}</p>
                </div>

                <div>
                  <label htmlFor="phone" className="field-label">Phone</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    className="field-input"
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
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="field-label">State</label>
                    <input
                      id="state"
                      name="state"
                      type="text"
                      value={form.state}
                      onChange={handleChange}
                      className="field-input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="bio" className="field-label">Bio</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    className="field-input min-h-[100px] resize-none"
                    placeholder="Tell flippers about yourself..."
                  />
                </div>

                <div>
                  <label className="field-label">Skills</label>
                  {form.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {form.skills.map(skill => (
                        <span key={skill} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill(skillInput))}
                      className="field-input flex-1"
                      placeholder="Add a skill (press Enter)"
                    />
                    <Button
                      type="button"
                      onClick={() => addSkill(skillInput)}
                      variant="outline"
                      size="sm"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div>
                  <label htmlFor="paypal_email" className="field-label">PayPal Email</label>
                  <input
                    id="paypal_email"
                    name="paypal_email"
                    type="email"
                    value={form.paypal_email}
                    onChange={handleChange}
                    className="field-input"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}

                <Button type="submit" className="w-full" loading={loading}>
                  Save Profile
                </Button>
              </form>
            </div>
          </div>

          <div>
            <Link href={`/workers/${form.username}`} className="text-sm text-accent hover:underline">
              View your public profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}