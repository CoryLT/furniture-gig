'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LocationSelect } from '@/components/ui/location-select'
import {
  Upload,
  X,
  Image as ImageIcon,
  Tag,
  DollarSign,
  ArrowLeft,
  Save,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import Link from 'next/link'
import { compressImageForUpload } from '@/lib/imageCompression'
import type {
  MarketplaceListingRow,
  MarketplacePhotoRow,
  MarketplaceCategoryRow,
} from '@/types/database'

interface Props {
  listing: MarketplaceListingRow
  initialPhotos: MarketplacePhotoRow[]
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

export default function EditListingForm({
  listing,
  initialPhotos,
  categories,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  // Prefill from existing values
  const [form, setForm] = useState({
    title: listing.title,
    description: listing.description ?? '',
    category_slug: listing.category_slug,
    price_mode: listing.price_mode,
    price_dollars:
      listing.price_mode === 'fixed'
        ? (listing.price_cents / 100).toString()
        : '',
    condition: listing.condition ?? '',
    city: listing.location_city,
    state: listing.location_state,
  })

  const [photos, setPhotos] = useState<LocalPhoto[]>(
    initialPhotos.map((p) => ({
      id: p.id,
      url: supabase.storage.from('marketplace-photos').getPublicUrl(p.file_path)
        .data.publicUrl,
      file_path: p.file_path,
    }))
  )

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    let priceCents = 0
    if (form.price_mode === 'fixed') {
      const cleaned = form.price_dollars.replace(/[^0-9.]/g, '')
      const dollars = parseFloat(cleaned)
      if (Number.isNaN(dollars) || dollars <= 0) {
        setError('Please enter a price greater than $0, or pick "Free".')
        setSaving(false)
        return
      }
      priceCents = Math.round(dollars * 100)
    }

    const res = await fetch(`/api/marketplace/${listing.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        category_slug: form.category_slug,
        price_mode: form.price_mode,
        price_cents: priceCents,
        condition: form.condition || null,
        location_city: form.city,
        location_state: form.state,
      }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error || 'Could not save changes.')
      return
    }

    setSuccess('Changes saved.')
    router.refresh()
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setError('')

    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) {
        setError(`You can upload up to ${MAX_PHOTOS} photos per listing.`)
        break
      }
      if (!file.type.startsWith('image/')) continue
      if (file.size > 25 * 1024 * 1024) continue

      // Compress big photos (e.g. straight from a phone) before uploading.
      // Vercel has a hard 4.5MB body limit on functions.
      const fileToUpload = await compressImageForUpload(file)

      const fd = new FormData()
      fd.append('file', fileToUpload)
      fd.append('listingId', listing.id)
      fd.append('sortOrder', String(photos.length))

      let res: Response
      try {
        res = await fetch('/api/upload-marketplace-photo', {
          method: 'POST',
          body: fd,
        })
      } catch (err) {
        setError(
          `Upload of "${file.name}" failed. ${
            err instanceof Error ? err.message : ''
          }`
        )
        continue
      }

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
        setError(json.error || 'Upload failed.')
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
  // optimistically, then persists to the DB. Reverts on failure.
  async function movePhoto(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= photos.length) return

    const reordered = [...photos]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    const previousOrder = photos
    setPhotos(reordered)

    const res = await fetch(
      `/api/marketplace/${listing.id}/reorder-photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: reordered.map((p) => p.id) }),
      }
    )

    if (!res.ok) {
      setPhotos(previousOrder)
      const json = await res.json().catch(() => ({}))
      setError(json.error || 'Could not save the new photo order.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/marketplace/mine"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to my listings
        </Link>
        <h1 className="text-3xl text-foreground">Edit Listing</h1>
      </div>

      {error && (
        <div className="card card-body border-red-300 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="card card-body border-green-300 bg-green-50 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Details form */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="title" className="field-label">Title</label>
              <input
                id="title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                className="field-input"
                maxLength={120}
                required
              />
            </div>

            <div>
              <label htmlFor="category_slug" className="field-label">Category</label>
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
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Pricing</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, price_mode: 'fixed' }))}
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
                  onClick={() => setForm((p) => ({ ...p, price_mode: 'free', price_dollars: '' }))}
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    name="price_dollars"
                    type="text"
                    inputMode="decimal"
                    value={form.price_dollars}
                    onChange={handleChange}
                    className="field-input pl-7"
                    placeholder="150"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="condition" className="field-label">
                Condition <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <select
                id="condition"
                name="condition"
                value={form.condition}
                onChange={handleChange}
                className="field-input"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <LocationSelect
              selectedState={form.state}
              selectedCity={form.city}
              onStateChange={handleStateChange}
              onCityChange={handleCityChange}
            />

            <div>
              <label htmlFor="description" className="field-label">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="field-input min-h-[120px] resize-none"
              />
            </div>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              loading={saving}
            >
              <Save className="w-4 h-4" />
              Save changes
            </Button>
          </form>
        </div>
      </div>

      {/* Photos */}
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
              <ImageIcon className="w-10 h-10 mb-2 opacity-50" strokeWidth={1.5} />
              <p className="text-sm font-medium">Tap to add photos</p>
            </button>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p, index) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="w-full h-full object-cover" />

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
            The first photo is the cover image. Use the arrows to reorder.
          </p>
        </div>
      </div>
    </div>
  )
}
