'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LocationSelect } from '@/components/ui/location-select'
import {
  ChevronRight,
  Check,
  Upload,
  X,
  Image as ImageIcon,
  Tag,
  DollarSign,
} from 'lucide-react'
import type { MarketplaceCategoryRow } from '@/types/database'

interface Props {
  categories: MarketplaceCategoryRow[]
}

interface LocalPhoto {
  id: string
  url: string
  file_path: string
}

const CONDITIONS = [
  { value: '', label: '— Optional —' },
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For Parts' },
]

const MAX_PHOTOS = 10

export default function NewListingForm({ categories }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'details' | 'photos'>('details')
  const [savedListingId, setSavedListingId] = useState<string | null>(null)
  const [savedListingSlug, setSavedListingSlug] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_slug: '',
    price_mode: 'fixed' as 'fixed' | 'free',
    price_dollars: '',
    condition: '',
    city: '',
    state: '',
  })

  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // -- Beforeunload warning if user has unsaved photo work --
  // If the listing was created (step 2) but they navigate away, we want
  // them to know they can come back via /marketplace/mine.
  useEffect(() => {
    if (step !== 'photos') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleStateChange(state: string) {
    setForm((prev) => ({ ...prev, state, city: '' }))
  }

  function handleCityChange(city: string) {
    setForm((prev) => ({ ...prev, city }))
  }

  // ----- Step 1: submit details -----
  async function handleSubmitDetails(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Convert dollars (string, possibly with $/commas) to cents
    let priceCents = 0
    if (form.price_mode === 'fixed') {
      const cleaned = form.price_dollars.replace(/[^0-9.]/g, '')
      const dollars = parseFloat(cleaned)
      if (Number.isNaN(dollars) || dollars <= 0) {
        setError('Please enter a price greater than $0, or pick "Free".')
        setLoading(false)
        return
      }
      priceCents = Math.round(dollars * 100)
    }

    const body = {
      title: form.title,
      description: form.description,
      category_slug: form.category_slug,
      price_mode: form.price_mode,
      price_cents: priceCents,
      condition: form.condition || null,
      location_city: form.city,
      location_state: form.state,
      location_lat: null,
      location_lng: null,
    }

    const res = await fetch('/api/marketplace/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Could not save the listing.')
      setLoading(false)
      return
    }

    setSavedListingId(json.id)
    setSavedListingSlug(json.slug)
    setStep('photos')
    setLoading(false)
  }

  // ----- Step 2: photos -----
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0 || !savedListingId) return

    setUploading(true)
    setError('')

    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) {
        setError(`You can upload up to ${MAX_PHOTOS} photos per listing.`)
        break
      }
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.')
        continue
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('Images must be under 25MB.')
        continue
      }

      const fd = new FormData()
      fd.append('file', file)
      fd.append('listingId', savedListingId)
      fd.append('sortOrder', String(photos.length))

      const res = await fetch('/api/upload-marketplace-photo', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()

      if (!res.ok || !json.image) {
        setError(json.error || 'Upload failed. Please try a different image.')
        continue
      }

      setPhotos((prev) => [
        ...prev,
        {
          id: json.image.id,
          url: json.image.url,
          file_path: json.image.file_path,
        },
      ])
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removePhoto(photoId: string, filePath: string) {
    await supabase.storage.from('marketplace-photos').remove([filePath])
    await supabase.from('marketplace_photos').delete().eq('id', photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  function handlePublish() {
    if (!savedListingSlug) return
    router.push(`/marketplace/${savedListingSlug}`)
    router.refresh()
  }

  // ===================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-foreground">List an Item</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {step === 'details'
            ? 'Tell buyers what you\u2019re selling.'
            : 'Add photos so people can see what you\u2019re selling. Up to 10 photos.'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <div
          className={`flex items-center gap-2 ${
            step === 'details' ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              step === 'details'
                ? 'bg-accent text-accent-foreground'
                : 'bg-stone-100 text-muted-foreground'
            }`}
          >
            {step === 'photos' ? <Check className="h-4 w-4" /> : '1'}
          </div>
          <span>Details</span>
        </div>
        <ChevronRight className="h-4 w-4 text-stone-300" />
        <div
          className={`flex items-center gap-2 ${
            step === 'photos' ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              step === 'photos'
                ? 'bg-accent text-accent-foreground'
                : 'bg-stone-100 text-muted-foreground'
            }`}
          >
            2
          </div>
          <span>Photos</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="card card-body border-red-300 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ====================================================== */}
      {/* STEP 1: DETAILS */}
      {/* ====================================================== */}
      {step === 'details' && (
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmitDetails} className="space-y-5">
              {/* Title */}
              <div>
                <label htmlFor="title" className="field-label">
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  className="field-input"
                  placeholder="e.g. Refinished walnut dresser"
                  maxLength={120}
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category_slug" className="field-label">
                  Category
                </label>
                <select
                  id="category_slug"
                  name="category_slug"
                  value={form.category_slug}
                  onChange={handleChange}
                  className="field-input"
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing */}
              <div>
                <label className="field-label">Pricing</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        price_mode: 'fixed',
                      }))
                    }
                    className={`flex items-center justify-center gap-2 h-11 rounded-md border text-sm font-medium transition-colors ${
                      form.price_mode === 'fixed'
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Set a price
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        price_mode: 'free',
                        price_dollars: '',
                      }))
                    }
                    className={`flex items-center justify-center gap-2 h-11 rounded-md border text-sm font-medium transition-colors ${
                      form.price_mode === 'free'
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    Free
                  </button>
                </div>

                {form.price_mode === 'fixed' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <input
                      name="price_dollars"
                      type="text"
                      inputMode="decimal"
                      value={form.price_dollars}
                      onChange={handleChange}
                      className="field-input pl-7"
                      placeholder="150"
                      required={form.price_mode === 'fixed'}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Buyers can negotiate by messaging you. No &ldquo;make an offer&rdquo; button &mdash; keeps things simple.
                </p>
              </div>

              {/* Condition (optional) */}
              <div>
                <label htmlFor="condition" className="field-label">
                  Condition{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <select
                  id="condition"
                  name="condition"
                  value={form.condition}
                  onChange={handleChange}
                  className="field-input"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <LocationSelect
                selectedState={form.state}
                selectedCity={form.city}
                onStateChange={handleStateChange}
                onCityChange={handleCityChange}
              />

              {/* Description */}
              <div>
                <label htmlFor="description" className="field-label">
                  Description{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional but recommended)
                  </span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="field-input min-h-[120px] resize-none"
                  placeholder="Materials, dimensions, what was done to it, pickup info, etc."
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                loading={loading}
              >
                Continue to photos
                <ChevronRight className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* STEP 2: PHOTOS */}
      {/* ====================================================== */}
      {step === 'photos' && (
        <div className="space-y-5">
          {/* Upload */}
          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Photos ({photos.length}/{MAX_PHOTOS})
                </p>
                {photos.length < MAX_PHOTOS && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    loading={uploading}
                  >
                    <Upload className="w-4 h-4" />
                    Add photos
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              {photos.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-stone-300 hover:border-accent rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ImageIcon
                    className="w-10 h-10 mb-2 opacity-50"
                    strokeWidth={1.5}
                  />
                  <p className="text-sm font-medium">Tap to add photos</p>
                  <p className="text-xs">JPG, PNG, or HEIC up to 25MB each</p>
                </button>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id, p.file_path)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The first photo will be the cover image shown on the listing card.
              </p>
            </div>
          </div>

          {/* Publish / skip */}
          <div className="card card-body space-y-3">
            <Button
              type="button"
              variant="accent"
              size="lg"
              className="w-full"
              onClick={handlePublish}
            >
              {photos.length === 0 ? 'Publish without photos' : 'Publish listing'}
              <ChevronRight className="w-4 h-4" />
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Listings with photos get a lot more interest. You can add more later from <span className="font-medium">My Listings</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
