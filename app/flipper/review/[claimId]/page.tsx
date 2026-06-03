import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { MapPin, Calendar, ArrowLeft } from 'lucide-react'
import FlipperReviewActions from './FlipperReviewActions'
import PayWorkerCard from '@/components/shared/PayWorkerCard'
import type { GigImageRow } from '@/types/database'

// Always fetch fresh — claim status changes frequently in this flow.
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { claimId: string }
}

export default async function FlipperReviewPage({ params }: Props) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load the claim (no embed-join — RLS quirks). We get the worker name
  // separately, same pattern as the flipper gig detail page.
  const { data: claim } = await supabase
    .from('gig_claims')
    .select('*')
    .eq('id', params.claimId)
    .maybeSingle()

  if (!claim) notFound()

  // Load the gig and confirm the caller is the poster.
  const { data: gig } = await supabase
    .from('gigs')
    .select('*')
    .eq('id', (claim as any).gig_id)
    .maybeSingle()

  if (!gig) notFound()

  const posterId =
    (gig as any).poster_user_id ?? (gig as any).created_by
  if (posterId !== user.id) {
    // Not your gig. Bounce them home.
    redirect('/flipper/dashboard')
  }

  // Load worker profile for name/contact display.
  const { data: worker } = await supabase
    .from('worker_profiles')
    .select('first_name, last_name, city, state, username')
    .eq('user_id', (claim as any).worker_user_id)
    .maybeSingle()

  // Checklist + completion state.
  const { data: checklist } = await supabase
    .from('gig_checklist_items')
    .select('*')
    .eq('gig_id', (gig as any).id)
    .order('sort_order')

  const checklistIds = (checklist ?? []).map((c: any) => c.id)
  const { data: completions } =
    checklistIds.length > 0
      ? await supabase
          .from('gig_task_completions')
          .select('*')
          .eq('worker_user_id', (claim as any).worker_user_id)
          .in('checklist_item_id', checklistIds)
      : { data: [] }

  const completionMap = new Map(
    ((completions as any[]) ?? []).map((c) => [c.checklist_item_id, c])
  )

  // Worker proof photos.
  const { data: photos } = await supabase
    .from('gig_photo_uploads')
    .select('*')
    .eq('gig_id', (gig as any).id)
    .eq('worker_user_id', (claim as any).worker_user_id)
    .order('uploaded_at')

  const photosWithUrls = ((photos as any[]) ?? []).map((p) => ({
    ...p,
    url: supabase.storage.from('gig-photos').getPublicUrl(p.file_path).data.publicUrl,
  }))

  // Reference images the flipper attached when posting the gig.
  const { data: referenceImages } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', (gig as any).id)
    .order('sort_order')

  const referenceImagesWithUrls = ((referenceImages as any[]) ?? []).map(
    (img: GigImageRow) => ({
      ...img,
      url: supabase.storage.from('gig-images').getPublicUrl(img.file_path).data
        .publicUrl,
    })
  )

  const workerName = worker
    ? `${(worker as any).first_name ?? ''} ${(worker as any).last_name ?? ''}`.trim() || 'Worker'
    : 'Worker'

  const claimStatus = (claim as any).status as string

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/flipper/gigs/${(gig as any).id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to job
      </Link>

      {/* Gig header */}
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl text-foreground">{(gig as any).title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {claimStatus === 'submitted_for_review'
              ? 'Submitted for review'
              : `Review (${claimStatus})`}
          </p>
        </div>
        <div className="card-body space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {((gig as any).location_text ||
              ((gig as any).city && (gig as any).state)) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {(gig as any).city && (gig as any).state
                  ? `${(gig as any).city}, ${(gig as any).state}`
                  : (gig as any).location_text}
              </span>
            )}
            {(gig as any).due_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Due {formatDate((gig as any).due_date)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
            <div>
              <p className="text-xs text-muted-foreground">Worker</p>
              <p className="font-medium text-foreground">{workerName}</p>
              {(worker as any)?.city && (worker as any)?.state && (
                <p className="text-xs text-muted-foreground">
                  {(worker as any).city}, {(worker as any).state}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Gig pay</p>
              <p className="font-mono font-semibold text-xl text-foreground">
                {formatCurrency((gig as any).pay_amount)}
              </p>
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
            {(checklist as any[]).map((item: any) => {
              const completion = completionMap.get(item.id) as any
              const done = completion?.completed ?? false
              return (
                <div key={item.id} className="px-6 py-3 flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${
                      done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {done ? '✓' : '○'}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        done ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {item.title}
                      {item.required && !done && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </p>
                    {completion?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">
                        &quot;{completion.notes}&quot;
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reference images (what the flipper posted) */}
      {referenceImagesWithUrls.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-sans font-semibold text-foreground">Your reference images</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {referenceImagesWithUrls.map((image: any) => (
                <div key={image.id} className="space-y-1">
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-md overflow-hidden bg-muted border border-border hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.caption || 'Reference image'}
                      className="w-full h-full object-cover"
                    />
                  </a>
                  {image.caption && (
                    <p className="text-xs text-muted-foreground">{image.caption}</p>
                  )}
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
            <h2 className="font-sans font-semibold text-foreground">
              Worker&apos;s proof photos ({photosWithUrls.length})
            </h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photosWithUrls.map((photo: any) => (
                <div key={photo.id} className="space-y-1">
                  <a
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-md overflow-hidden bg-muted border border-border hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Proof photo'}
                      className="w-full h-full object-cover"
                    />
                  </a>
                  {photo.caption && (
                    <p className="text-xs text-muted-foreground">{photo.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Decision buttons */}
      {claimStatus === 'submitted_for_review' && (
        <FlipperReviewActions
          claimId={(claim as any).id}
          gigId={(gig as any).id}
          workerId={(claim as any).worker_user_id}
          payAmount={Number((gig as any).pay_amount)}
        />
      )}

      {claimStatus === 'approved' && (
        <PayWorkerCard
          gigId={(gig as any).id}
          workerId={(claim as any).worker_user_id}
          workerName={workerName}
          amount={Number((gig as any).pay_amount)}
          flipperUserId={user.id}
        />
      )}

      {claimStatus !== 'submitted_for_review' && claimStatus !== 'approved' && (
        <div className="card card-body text-center text-sm text-muted-foreground">
          This submission has already been {claimStatus}.
        </div>
      )}
    </div>
  )
}
