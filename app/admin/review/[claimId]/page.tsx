import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MapPin, Calendar } from 'lucide-react'
import ReviewActions from './ReviewActions'
import type { GigImageRow } from '@/types/database'

interface Props {
  params: { claimId: string }
}

export default async function AdminReviewPage({ params }: Props) {
  const supabase = createClient()

  const { data: claim } = await supabase
    .from('gig_claims')
    .select(`*, gigs(*), worker_profiles!inner(first_name, last_name, paypal_email, city, state)`)
    .eq('id', params.claimId)
    .single()

  if (!claim) notFound()

  const gig = claim.gigs as any
  const worker = claim.worker_profiles as any

  // Load checklist + completions
  const { data: checklist } = await supabase
    .from('gig_checklist_items')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const { data: completions } = await supabase
    .from('gig_task_completions')
    .select('*')
    .eq('worker_user_id', claim.worker_user_id)
    .in('checklist_item_id', checklist?.map((c: any) => c.id) ?? [])

  // Load worker proof photos
  const { data: photos } = await supabase
    .from('gig_photo_uploads')
    .select('*')
    .eq('gig_id', gig.id)
    .eq('worker_user_id', claim.worker_user_id)
    .order('uploaded_at')

  // Load admin reference images
  const { data: referenceImages } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const completionMap = new Map(completions?.map((c: any) => [c.checklist_item_id, c]) ?? [])

  // Get public URLs for photos
  const photosWithUrls = photos?.map((p: any) => ({
    ...p,
    url: supabase.storage.from('gig-photos').getPublicUrl(p.file_path).data.publicUrl,
  })) ?? []

  // Get public URLs for reference images
  const referenceImagesWithUrls = (referenceImages ?? []).map((img: GigImageRow) => ({
    ...img,
    url: supabase.storage.from('gig-images').getPublicUrl(img.file_path).data.publicUrl,
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to dashboard
      </a>

      {/* Gig header */}
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl text-foreground">{gig.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Submitted for review</p>
        </div>
        <div className="card-body space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {gig.location_text && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {gig.location_text}</span>}
            {gig.due_date && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Due {formatDate(gig.due_date)}</span>}
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
            <div>
              <p className="text-xs text-muted-foreground">Worker</p>
              <p className="font-medium text-foreground">{worker.first_name} {worker.last_name}</p>
              <p className="text-xs text-muted-foreground">PayPal: {worker.paypal_email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Payout</p>
              <p className="font-mono font-semibold text-xl text-foreground">{formatCurrency(gig.pay_amount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist review */}
      {checklist && checklist.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-sans font-semibold text-foreground">Checklist</h2>
          </div>
          <div className="divide-y divide-border">
            {checklist.map((item: any) => {
              const completion = completionMap.get(item.id) as any
              const done = completion?.completed ?? false
              return (
                <div key={item.id} className="px-6 py-3 flex items-start gap-3">
                  <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {done ? '✓' : '○'}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.title}
                      {item.required && !done && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {completion?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{completion.notes}"</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reference images from admin */}
      {referenceImagesWithUrls.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-sans font-semibold text-foreground">Reference Images</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {referenceImagesWithUrls.map((image: any) => (
                <div key={image.id} className="space-y-1">
                  <a href={image.url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden bg-muted border border-border hover:opacity-90 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.caption || 'Reference image'} className="w-full h-full object-cover" />
                  </a>
                  {image.caption && <p className="text-xs text-muted-foreground">{image.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Worker proof photos */}
      {photosWithUrls.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-sans font-semibold text-foreground">Proof Photos ({photosWithUrls.length})</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photosWithUrls.map((photo: any) => (
                <div key={photo.id} className="space-y-1">
                  <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden bg-muted border border-border hover:opacity-90 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.caption || 'Proof photo'} className="w-full h-full object-cover" />
                  </a>
                  {photo.caption && <p className="text-xs text-muted-foreground">{photo.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review actions */}
      {claim.status === 'submitted_for_review' && (
        <ReviewActions
          claimId={claim.id}
          gigId={gig.id}
          workerId={claim.worker_user_id}
          payAmount={gig.pay_amount}
        />
      )}

      {claim.status !== 'submitted_for_review' && (
        <div className="card card-body text-center text-sm text-muted-foreground">
          This submission has already been {claim.status}.
        </div>
      )}
    </div>
  )
}
