import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Star, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function displayName(p?: {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
}): string {
  if (!p) return 'Worker'
  const full = (p.full_name ?? '').trim()
  if (full) return full
  const fl = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  if (fl) return fl
  if (p.username) return p.username
  return 'Worker'
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-sm text-muted-foreground">Not rated</span>
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= rating ? 'text-accent fill-accent' : 'text-muted-foreground'}`}
        />
      ))}
    </span>
  )
}

export default async function CrewPersonPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const me = user.id
  const id = params.id

  // ---- Off-platform person? (a name-only crew_members row I own) ----
  const { data: off } = await supabase
    .from('crew_members')
    .select('id, worker_name, jobs_count, paid_total, rating, notes, would_rehire')
    .eq('id', id)
    .eq('operator_user_id', me)
    .is('worker_user_id', null)
    .maybeSingle()

  if (off) {
    const o = off as any
    const name = (o.worker_name || 'Unnamed').trim() || 'Unnamed'
    return (
      <div className="space-y-6 max-w-2xl">
        <BackLink />
        <Header name={name} subtitle="Off-platform crew" />
        <SummaryCards
          jobs={o.jobs_count ?? 0}
          paid={Number(o.paid_total ?? 0)}
          paidLabel="Cash paid (your tally)"
        />
        <RatingNotes rating={o.rating ?? null} wouldRehire={o.would_rehire ?? null} notes={o.notes ?? ''} />
        <div className="card card-body text-sm text-muted-foreground">
          This person was hired in person, so there&apos;s no line-by-line history yet — just
          the running tally above. Edit their rating, notes, jobs, and cash on the{' '}
          <Link href="/flipper/crew" className="text-accent hover:underline">My Crew</Link> page.
        </div>
      </div>
    )
  }

  // ---- Otherwise treat id as an on-platform worker (worker_user_id) ----
  const { data: prof } = await supabase
    .from('worker_profiles')
    .select('user_id, full_name, first_name, last_name, username')
    .eq('user_id', id)
    .maybeSingle()

  const { data: payRaw } = await supabase
    .from('gig_payments')
    .select('gig_id, amount, marked_paid_at, worker_confirmed_at')
    .eq('flipper_user_id', me)
    .eq('worker_user_id', id)
  const payments = (payRaw ?? []) as {
    gig_id: string
    amount: number | null
    marked_paid_at: string | null
    worker_confirmed_at: string | null
  }[]

  // If there's no profile AND no payments with me, this id isn't my crew.
  if (!prof && payments.length === 0) notFound()

  const { data: note } = await supabase
    .from('crew_members')
    .select('rating, notes, would_rehire')
    .eq('operator_user_id', me)
    .eq('worker_user_id', id)
    .maybeSingle()

  // Job titles for the history list.
  const gigIds = payments.map((p) => p.gig_id)
  const titleById: Record<string, string> = {}
  if (gigIds.length) {
    const { data: gigs } = await supabase.from('gigs').select('id, title').in('id', gigIds)
    for (const g of (gigs ?? []) as any[]) titleById[g.id] = g.title || 'Untitled job'
  }

  const confirmedPaid = payments
    .filter((p) => p.worker_confirmed_at && p.amount)
    .reduce((s, p) => s + Number(p.amount), 0)
  const jobsPaid = payments.length

  const sorted = [...payments].sort((a, b) => {
    const ad = a.marked_paid_at ? Date.parse(a.marked_paid_at) : 0
    const bd = b.marked_paid_at ? Date.parse(b.marked_paid_at) : 0
    return bd - ad
  })

  const name = displayName(prof as any)
  const username = (prof as any)?.username ?? null

  return (
    <div className="space-y-6 max-w-2xl">
      <BackLink />
      <div className="flex items-start justify-between gap-3">
        <Header name={name} subtitle="On-platform crew" />
        {username && (
          <Link
            href={`/u/${username}`}
            className="text-sm text-accent hover:underline shrink-0 mt-1"
          >
            View profile
          </Link>
        )}
      </div>

      <SummaryCards jobs={jobsPaid} paid={confirmedPaid} paidLabel="Paid & confirmed" />
      <RatingNotes
        rating={(note as any)?.rating ?? null}
        wouldRehire={(note as any)?.would_rehire ?? null}
        notes={(note as any)?.notes ?? ''}
      />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Payment history</h2>
        {sorted.length === 0 ? (
          <div className="card card-body text-sm text-muted-foreground">
            No payments logged with this person yet.
          </div>
        ) : (
          <div className="card divide-y divide-border">
            {sorted.map((p) => {
              const status = p.worker_confirmed_at
                ? { label: 'Paid & confirmed', cls: 'text-emerald-600' }
                : p.marked_paid_at
                  ? { label: 'Marked paid', cls: 'text-accent' }
                  : { label: 'Not paid yet', cls: 'text-muted-foreground' }
              const when = p.marked_paid_at
                ? new Date(p.marked_paid_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : null
              return (
                <div key={p.gig_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {titleById[p.gig_id] || 'Job'}
                    </p>
                    <p className={`text-xs ${status.cls} flex items-center gap-1`}>
                      {p.worker_confirmed_at && <CheckCircle2 className="w-3 h-3" />}
                      {status.label}
                      {when ? ` · ${when}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0">
                    {p.amount != null ? formatCurrency(Number(p.amount)) : '—'}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/flipper/crew"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to My Crew
    </Link>
  )
}

function Header({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center text-lg font-semibold shrink-0">
        {name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-foreground leading-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function SummaryCards({
  jobs,
  paid,
  paidLabel,
}: {
  jobs: number
  paid: number
  paidLabel: string
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="card card-body">
        <p className="text-2xl font-semibold text-foreground leading-none">{jobs}</p>
        <p className="text-sm text-muted-foreground mt-1">Jobs</p>
      </div>
      <div className="card card-body">
        <p className="text-2xl font-semibold text-foreground leading-none">{formatCurrency(paid)}</p>
        <p className="text-sm text-muted-foreground mt-1">{paidLabel}</p>
      </div>
    </div>
  )
}

function RatingNotes({
  rating,
  wouldRehire,
  notes,
}: {
  rating: number | null
  wouldRehire: boolean | null
  notes: string
}) {
  return (
    <div className="card card-body space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Your rating</span>
        <Stars rating={rating} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Would rehire</span>
        <span className="text-sm text-foreground">
          {wouldRehire === true ? 'Yes' : wouldRehire === false ? 'No' : '—'}
        </span>
      </div>
      {notes.trim() && (
        <div>
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{notes}</p>
        </div>
      )}
    </div>
  )
}
