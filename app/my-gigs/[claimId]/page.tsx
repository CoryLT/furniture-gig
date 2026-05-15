import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, claimStatusLabel, claimStatusClass } from '@/lib/utils'
import { MapPin, Calendar } from 'lucide-react'
import ChecklistSection from './ChecklistSection'
import PhotoSection from './PhotoSection'
import SubmitSection from './SubmitSection'

interface Props {
  params: { claimId: string }
}

export default async function MyGigDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load claim with gig
  const { data: claim } = await supabase
    .from('gig_claims')
    .select(`*, gigs(*)`)
    .eq('id', params.claimId)
    .eq('worker_user_id', user.id)
    .single()

  if (!claim) notFound()

  const gig = claim.gigs as any

  // Load checklist items
  const { data: checklist } = await supabase
    .from('gig_checklist_items')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  // Load this worker's task completions
  const { data: completions } = await supabase
    .from('gig_task_completions')
    .select('*')
    .eq('worker_user_id', user.id)
    .in('checklist_item_id', checklist?.map((c) => c.id) ?? [])

  // Load photos
  const { data: photos } = await supabase
    .from('gig_photo_uploads')
    .select('*')
    .eq('gig_id', gig.id)
    .eq('worker_user_id', user.id)
    .order('uploaded_at')

  const completionMap = new Map(completions?.map((c) => [c.checklist_item_id, c]) ?? [])
  const canSubmit = claim.status === 'active'
  const isReadOnly = ['submitted_for_review', 'approved', 'rejected', 'cancelled'].includes(claim.status)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <a href="/my-gigs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to My Gigs
      </a>

      {/* Header */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={claimStatusClass(claim.status)}>{claimStatusLabel(claim.status)}</span>
              <h1 className="text-2xl text-foreground mt-2">{gig.title}</h1>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-semibold text-xl text-foreground">{formatCurrency(gig.pay_amount)}</p>
              <p className="text-xs text-muted-foreground">payout</p>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {gig.location_text && (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {gig.location_text}</span>
            )}
            {gig.due_date && (
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Due {formatDate(gig.due_date)}</span>
            )}
          </div>
          {gig.description && (
            <p className="text-sm text-foreground mt-3 whitespace-pre-wrap">{gig.description}</p>
          )}
        </div>
      </div>

      {/* Checklist */}
      {checklist && checklist.length > 0 && (
        <ChecklistSection
          checklist={checklist}
          completionMap={completionMap}
          userId={user.id}
          readOnly={isReadOnly}
        />
      )}

      {/* Photos */}
      <PhotoSection
        gigId={gig.id}
        userId={user.id}
        photos={photos ?? []}
        readOnly={isReadOnly}
      />

      {/* Submit for review */}
      {canSubmit && (
        <SubmitSection
          claimId={claim.id}
          checklist={checklist ?? []}
          completionMap={completionMap}
        />
      )}

      {isReadOnly && (
        <div className="card card-body text-center text-sm text-muted-foreground">
          {claim.status === 'submitted_for_review'
            ? 'Your work has been submitted and is awaiting review.'
            : claim.status === 'approved'
            ? '✓ This gig has been approved. Payment will be sent via PayPal.'
            : 'This gig claim is closed.'}
        </div>
      )}
    </div>
  )
}
