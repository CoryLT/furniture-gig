import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GigFormMultiStep from '@/components/admin/GigFormMultiStep'
import type { GigRow, GigChecklistItemRow, GigImageRow } from '@/types/database'

interface Props {
  params: { id: string }
}

export default async function EditGigPage({ params }: Props) {
  const supabase = createClient()

  const { data } = await supabase
    .from('gigs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!data) notFound()

  // Ensure required_skills is always an array, never null/undefined
  const gig = {
    ...data,
    required_skills: Array.isArray(data.required_skills) ? data.required_skills : (data.required_skills ? [data.required_skills] : [])
  } as GigRow

  const { data: checklistData } = await supabase
    .from('gig_checklist_items')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const checklist = (checklistData ?? []) as GigChecklistItemRow[]

  const { data: imagesData } = await supabase
    .from('gig_images')
    .select('*')
    .eq('gig_id', gig.id)
    .order('sort_order')

  const images = (imagesData ?? []) as GigImageRow[]

  return (
    <div className="space-y-6">
      <div>
        <a href="/admin/gigs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to gigs
        </a>
        <h1 className="text-3xl text-foreground mt-2">Edit Gig</h1>
        <p className="text-muted-foreground text-sm mt-1 font-mono">{gig.slug}</p>
      </div>
      <GigFormMultiStep gig={gig} checklist={checklist} images={images} mode="edit" />
    </div>
  )
}