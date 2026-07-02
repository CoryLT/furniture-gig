import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PastSaleForm from './PastSaleForm'

// Always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AddPastSalePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id

  // Crew list for the "who did you pay?" picker when a fix-up cost is labor.
  const { data: crewRaw } = await supabase
    .from('crew_members')
    .select('id, worker_user_id, worker_name')
    .eq('operator_user_id', me)
    .eq('hidden', false)
  const onIds = ((crewRaw ?? []) as any[]).map((c) => c.worker_user_id).filter(Boolean)
  const nameById: Record<string, string> = {}
  if (onIds.length) {
    const { data: profs } = await supabase
      .from('worker_profiles')
      .select('user_id, full_name, first_name, last_name')
      .in('user_id', onIds)
    for (const p of (profs ?? []) as any[]) {
      nameById[p.user_id] =
        (p.full_name || '').trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
        'Crew'
    }
  }
  const crew = ((crewRaw ?? []) as any[]).map((c) => ({
    id: c.id,
    label: c.worker_user_id ? nameById[c.worker_user_id] || 'Crew' : c.worker_name || 'Crew',
  }))

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <Link
        href="/flipper/pipeline"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">Log a sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Just sold something? Type what it was and what it sold for. The month is set to
          now, so a fresh sale takes seconds — change it only for something you sold a
          while ago. The exact day doesn&apos;t matter for your books.
        </p>
      </div>

      <PastSaleForm me={me} crew={crew} />
    </main>
  )
}
