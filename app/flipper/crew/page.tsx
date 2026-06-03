import { createClient } from '@/lib/supabase/server'
import CrewList from './CrewList'
import { formatCurrency } from '@/lib/utils'

// Crew data changes whenever a worker is picked or paid — always fresh.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProfileRow = {
  user_id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
}

// Name columns are inconsistent in this app: full_name is the going-forward
// column, but older rows used first_name/last_name. Prefer full_name, then
// first+last, then username, then a safe fallback.
function displayName(p?: ProfileRow): string {
  if (!p) return 'Worker'
  const full = (p.full_name ?? '').trim()
  if (full) return full
  const fl = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (fl) return fl
  if (p.username) return p.username
  return 'Worker'
}

export default async function CrewPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = user!.id

  // 1) Gigs I posted. The owner column is inconsistent across the app
  //    (poster_user_id on newer rows, created_by on older), so match either.
  const { data: myGigs } = await supabase
    .from('gigs')
    .select('id')
    .or(`poster_user_id.eq.${me},created_by.eq.${me}`)
  const gigIds = ((myGigs ?? []) as { id: string }[]).map((g) => g.id)

  // 2) Workers I actually ENGAGED — i.e. picked. In the live claim
  //    lifecycle that's 'active' (picked) and everything past it.
  //    'pending' applicants I never chose are NOT crew.
  const ENGAGED = ['active', 'submitted_for_review', 'approved']
  const { data: claimsRaw } = gigIds.length
    ? await supabase
        .from('gig_claims')
        .select('worker_user_id, status')
        .in('gig_id', gigIds)
        .in('status', ENGAGED)
    : { data: [] as any[] }
  const claims = (claimsRaw ?? []) as { worker_user_id: string; status: string }[]

  // 3) Payments I've made as the flipper (for the "paid" total).
  const { data: payRaw } = await supabase
    .from('gig_payments')
    .select('worker_user_id, amount, worker_confirmed_at')
    .eq('flipper_user_id', me)
  const payments = (payRaw ?? []) as {
    worker_user_id: string | null
    amount: number | null
    worker_confirmed_at: string | null
  }[]

  // Aggregate per worker: jobs picked, jobs completed, total confirmed-paid.
  const stats: Record<string, { jobs: number; completed: number; paid: number }> = {}
  function row(id: string) {
    if (!stats[id]) stats[id] = { jobs: 0, completed: 0, paid: 0 }
    return stats[id]
  }
  for (const c of claims) {
    if (!c.worker_user_id) continue
    const s = row(c.worker_user_id)
    s.jobs += 1
    if (c.status === 'approved') s.completed += 1
  }
  for (const p of payments) {
    if (!p.worker_user_id) continue
    const s = row(p.worker_user_id)
    if (p.worker_confirmed_at && p.amount) s.paid += Number(p.amount)
  }

  const workerIds = Object.keys(stats)

  // 4) Worker display names.
  const { data: profRaw } = workerIds.length
    ? await supabase
        .from('worker_profiles')
        .select('user_id, full_name, first_name, last_name, username')
        .in('user_id', workerIds)
    : { data: [] as any[] }
  const profById: Record<string, ProfileRow> = {}
  for (const p of (profRaw ?? []) as ProfileRow[]) profById[p.user_id] = p

  // 5) My existing private notes/ratings for these workers.
  const { data: noteRaw } = await supabase
    .from('crew_members')
    .select('worker_user_id, rating, notes, would_rehire, hidden')
    .eq('operator_user_id', me)
  const noteById: Record<
    string,
    {
      rating: number | null
      notes: string
      would_rehire: boolean | null
      hidden: boolean
    }
  > = {}
  for (const n of (noteRaw ?? []) as any[]) {
    noteById[n.worker_user_id] = {
      rating: n.rating ?? null,
      notes: n.notes ?? '',
      would_rehire: n.would_rehire ?? null,
      hidden: n.hidden ?? false,
    }
  }

  const crew = workerIds
    .map((id) => {
      const prof = profById[id]
      const note = noteById[id]
      return {
        workerId: id,
        name: displayName(prof),
        username: prof?.username ?? null,
        jobs: stats[id].jobs,
        completed: stats[id].completed,
        paid: stats[id].paid,
        rating: note?.rating ?? null,
        notes: note?.notes ?? '',
        wouldRehire: note?.would_rehire ?? null,
        hidden: note?.hidden ?? false,
      }
    })
    .sort((a, b) => b.jobs - a.jobs)

  const visible = crew.filter((c) => !c.hidden)
  const removed = crew.filter((c) => c.hidden)

  // Off-platform crew: name-only people you hired in person (no app account).
  const { data: offRaw } = await supabase
    .from('crew_members')
    .select('id, worker_name, jobs_count, paid_total')
    .eq('operator_user_id', me)
    .is('worker_user_id', null)
  const offCrew = ((offRaw ?? []) as any[]).map((m) => ({
    id: m.id as string,
    name: ((m.worker_name as string) || 'Unnamed').trim() || 'Unnamed',
    jobs: (m.jobs_count as number) ?? 0,
    paid: Number(m.paid_total ?? 0),
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-foreground">My Crew</h1>
        <p className="text-muted-foreground mt-1">
          Everyone you&apos;ve put to work. Rate them, keep private notes, and decide who to call back.
        </p>
      </div>

      {crew.length === 0 && offCrew.length === 0 ? (
        <div className="card card-body text-center py-16 space-y-3">
          <p className="text-lg text-muted-foreground">No crew yet.</p>
          <p className="text-sm text-muted-foreground">
            Once you pick a worker for one of your jobs, they&apos;ll show up here so you
            can track and rate them.
          </p>
        </div>
      ) : (
        <>
          {crew.length > 0 && <CrewList operatorId={me} crew={visible} removed={removed} />}

          {offCrew.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Off-platform crew</h2>
                <p className="text-sm text-muted-foreground">
                  People you hired in person and paid in cash. Tracked here by name.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {offCrew.map((m) => (
                  <div
                    key={m.id}
                    className="card card-body flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                        {m.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">Off-platform</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-foreground">
                        {m.jobs} job{m.jobs === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(m.paid)} paid</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
