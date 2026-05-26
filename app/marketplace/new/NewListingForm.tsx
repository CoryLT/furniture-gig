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
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import type { MarketplaceCategoryRow } from '@/types/database'
import { compressImageForUpload, isAcceptableImageFile } from '@/lib/imageCompression'

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

    // If we already created this listing earlier in the same flow,
    // a "back to details" + re-save should UPDATE the existing row,
    // not create a brand-new one. The update endpoint accepts all the
    // same fields and is a no-op for ones that haven't changed.
    if (savedListingId) {
      const res = await fetch(`/api/marketplace/${savedListingId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Could not update the listing.')
        setLoading(false)
        return
      }

      // Slug may have changed if title was edited
      if (json.slug) setSavedListingSlug(json.slug)
      setStep('photos')
      setLoading(false)
      return
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
      if (!isAcceptableImageFile(file)) {
        setError('Only image files are allowed.')
        continue
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('Images must be under 25MB.')
        continue
      }

      // Compress big photos (e.g. straight from a phone) down to ~1MB before
      // sending. Vercel has a hard 4.5MB body limit on functions — bigger
      // uploads die at the gateway with no error reaching our code.
      const fileToUpload = await compressImageForUpload(file)

      const fd = new FormData()
      fd.append('file', fileToUpload)
      fd.append('listingId', savedListingId)
      fd.append('sortOrder', String(photos.length))

      // Per-photo timeout (70s) so a single hung upload can't lock the
      // entire loop. Slightly longer than Vercel's 60s function max so the
      // server has a chance to return an error before we abort.
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 70_000)

      try {
        const res = await fetch('/api/upload-marketplace-photo', {
          method: 'POST',
          body: fd,
          signal: controller.signal,
        })

        // Vercel's 413 (too-large) error returns HTML, not JSON. Guard the
        // parse so we always show the user a clean message.
        let json: { image?: { id: string; url: string; file_path: string }; error?: string } = {}
        try {
          json = await res.json()
        } catch {
          if (res.status === 413) {
            setError(
              `"${file.name}" is too large to upload even after compression. Try a smaller photo.`
            )
          } else {
            setError(`Upload of "${file.name}" failed (server error ${res.status}).`)
          }
          continue
        }

        if (!res.ok || !json.image) {
          setError(json.error || 'Upload failed. Please try a different image.')
          continue
        }

        setPhotos((prev) => [
          ...prev,
          {
            id: json.image!.id,
            url: json.image!.url,
            file_path: json.image!.file_path,
          },
        ])
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        setError(
          aborted
            ? `Upload of "${file.name}" took too long and was cancelled. Try again or use a smaller image.`
            : `Upload of "${file.name}" failed. ${err instanceof Error ? err.message : ''}`
        )
        // Keep going — the next photo might still upload fine.
        continue
      } finally {
        clearTimeout(timeoutId)
      }
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removePhoto(photoId: string, filePath: string) {
    if (!confirm('Remove this photo?')) return
    await supabase.storage.from('marketplace-photos').remove([filePath])
    await supabase.from('marketplace_photos').delete().eq('id', photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  // Move a photo up or down in the order. Updates local state
  // optimistically, then persists to the DB. If the DB write fails,
  // revert the local state.
  async function movePhoto(index: number, direction: 'up' | 'down') {
    if (!savedListingId) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= photos.length) return

    const reordered = [...photos]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    const previousOrder = photos
    setPhotos(reordered)

    const res = await fetch(
      `/api/marketplace/${savedListingId}/reorder-photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: reordered.map((p) => p.id) }),
      }
    )

    if (!res.ok) {
      // Roll back
      setPhotos(previousOrder)
      const json = await res.json().catch(() => ({}))
      setError(json.error || 'Could not save the new photo order.')
    }
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
                {savedListingId ? 'Save changes' : 'Continue to photos'}
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
          {/* Back to details */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStep('details')}
            disabled={uploading}
          >
            ← Back to details
          </Button>

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
                  accept="image/*,.heic,.heif"
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
                  {photos.map((p, index) => (
                    <div
                      key={p.id}
                      className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />

                      {/* Cover badge on the first photo */}
                      {index === 0 && (
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-accent text-accent-foreground text-[10px] font-medium">
                          Cover
                        </div>
                      )}

                      {/* Delete (always visible) */}
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id, p.file_path)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center"
                        aria-label="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Move up / down */}
                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => movePhoto(index, 'up')}
                          disabled={index === 0}
                          className="w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move photo earlier"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhoto(index, 'down')}
                          disabled={index === photos.length - 1}
                          className="w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move photo later"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The first photo is the cover image shown on the listing card.
                Use the arrows to reorder.
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
