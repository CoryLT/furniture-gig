import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, gigStatusClass, gigStatusLabel } from '@/lib/utils'
import { MapPin, Calendar, Wrench, DollarSign } from 'lucide-react'
import ClaimButton from './ClaimButton'
import GigReferenceImages from '@/components/shared/GigReferenceImages'
import type { GigImageRow } from '@/types/database'

interface Props {
  params: { slug: string }
}

export default async function GigDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load gig
  const { data: gig } = await supabase
    .from('gigs')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!gig || !['open', 'claimed', 'in_review', 'completed'].includes(gig.status)) {
    notFound()
  }

  // Load checklist
  const { data: checklist } = await supabase
    .from('gig_checklist_items')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  // Load reference images
  const { data: imagesData } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const images = (imagesData ?? []) as GigImageRow[]

  // Load any existing claim
  const { data: claim } = await supabase
    .from('gig_claims')
    .select('*')
    .eq('gig_id', gig.id)
    .single()

  const myClaimId = claim?.worker_user_id === user.id ? claim : null
  const isClaimed = !!claim
  const isMyGig = claim?.worker_user_id === user.id

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <a href="/gigs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to gigs
      </a>

      {/* Header card */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={gigStatusClass(gig.status)}>{gigStatusLabel(gig.status)}</span>
                {gig.furniture_type && (
                  <span className="text-xs font-mono text-muted-foreground capitalize">{gig.furniture_type}</span>
                )}
              </div>
              <h1 className="text-2xl text-foreground">{gig.title}</h1>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 text-2xl font-mono font-semibold text-foreground">
                <DollarSign className="w-5 h-5 text-accent" />
                {gig.pay_amount.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">payout</p>
            </div>
          </div>
        </div>
        <div className="card-body space-y-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {gig.location_text && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {gig.location_text}
              </span>
            )}
            {gig.due_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Due {formatDate(gig.due_date)}
              </span>
            )}
          </div>

          {/* Skills */}
          {gig.required_skills.length > 0 && (
            <div className="flex items-start gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {gig.required_skills.map((skill) => (
                  <span key={skill} className="px-2 py-0.5 bg-secondary rounded-full text-xs font-medium text-secondary-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {gig.summary && (
            <p className="text-sm text-muted-foreground">{gig.summary}</p>
          )}

          {/* Description */}
          {gig.description && (
            <div className="prose-sm text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {gig.description}
            </div>
          )}
        </div>
      </div>

      {/* Reference images */}
      <GigReferenceImages images={images} />

      {/* Checklist preview */}
      {checklist && checklist.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-sans font-semibold text-foreground">Checklist ({checklist.length} items)</h2>
          </div>
          <div className="divide-y divide-border">
            {checklist.map((item, i) => (
              <div key={item.id} className="px-6 py-3 flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                    {item.required && <span className="text-destructive ml-1">*</span>}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim action */}
      <ClaimButton
        gig={gig}
        isClaimed={isClaimed}
        isMyGig={isMyGig}
        existingClaim={myClaimId}
        userId={user.id}
      />
    </div>
  )
}
