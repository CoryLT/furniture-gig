'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function FlipperProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    username: '',
    business_name: '',
    bio: '',
    city: '',
    state: '',
    website: '',
    avatar_url: '',
  })

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
      .from('flipper_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setForm({
        username: profileData.username || '',
        business_name: profileData.business_name || '',
        bio: profileData.bio || '',
        city: profileData.city || '',
        state: profileData.state || '',
        website: profileData.website || '',
        avatar_url: profileData.avatar_url || '',
      })
    }
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
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

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError('Upload failed: ' + (data.error || 'Unknown error'))
        return
      }

      setForm({ ...form, avatar_url: data.url })
      setSuccess('Avatar uploaded!')
    } catch (err) {
      setError('Upload error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }

    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.username) {
      setError('Username is required')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/flipper-profile/save', {
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
        <Link href="/flipper/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-serif text-foreground">Your Business Profile</h1>
            <p className="text-muted-foreground mt-1">Edit your flipper profile</p>
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
                  <p className="text-xs text-muted-foreground mt-1">Your public profile URL: flipwork.com/flippers/{form.username}</p>
                </div>

                <div>
                  <label htmlFor="business_name" className="field-label">
                    Business Name <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    id="business_name"
                    name="business_name"
                    type="text"
                    value={form.business_name}
                    onChange={handleChange}
                    className="field-input"
                    placeholder="Your business name"
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
                  <label htmlFor="website" className="field-label">
                    Website <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    value={form.website}
                    onChange={handleChange}
                    className="field-input"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="field-label">Bio</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={form.bio}
                    onChange={handleChange}
                    className="field-input min-h-[100px] resize-none"
                    placeholder="Tell workers about your business..."
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
            <Link href={`/flippers/${form.username}`} className="text-sm text-accent hover:underline">
              View your public profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}