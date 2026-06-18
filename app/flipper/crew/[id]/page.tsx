import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Star } from 'lucide-react'

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

  // Figure out who this is. The id is either an off-platform crew_members row
  // (name-only) or an on-platform worker_user_id. Either way we end up with a
  // crew_member id, which is how the ledger tags payments.
  let crewMemberId: string | null = null
  let name = 'Worker'
  let subtitle = ''
  let username: string | null = null
  let rating: number | null = null
  let wouldRehire: boolean | null = null
  let notes = ''

  const { data: off } = await supabase
    .from('crew_members')
    .select('id, worker_name, rating, notes, would_rehire')
    .eq('id', id)
    .eq('operator_user_id', me)
    .is('worker_user_id', null)
    .maybeSingle()

  if (off) {
    const o = off as any
    crewMemberId = o.id
    name = (o.worker_name || 'Unnamed').trim() || 'Unnamed'
    subtitle = 'Off-platform crew'
    rating = o.rating ?? null
    wouldRehire = o.would_rehire ?? null
    notes = o.notes ?? ''
  } else {
    const { data: prof } = await supabase
      .from('worker_profiles')
      .select('user_id, full_name, first_name, last_name, username')
      .eq('user_id', id)
      .maybeSingle()
    const { data: cm } = await supabase
      .from('crew_members')
      .select('id, rating, notes, would_rehire')
      .eq('operator_user_id', me)
      .eq('worker_user_id', id)
      .maybeSingle()
    if (!prof && !cm) notFound()
    crewMemberId = (cm as any)?.id ?? null
    name = displayName(prof as any)
    subtitle = 'On-platform crew'
    username = (prof as any)?.username ?? null
    rating = (cm as any)?.rating ?? null
    wouldRehire = (cm as any)?.would_rehire ?? null
    notes = (cm as any)?.notes ?? ''
  }

  // Payment history = labor you logged and tagged to this person (the ledger).
  let history: { date: string; note: string; amount: number }[] = []
  if (crewMemberId) {
    const { data: payRaw } = await supabase
      .from('worker_payments')
      .select('date, description, amount')
      .eq('owner_user_id', me)
      .eq('crew_member_id', crewMemberId)
    history = ((payRaw ?? []) as any[])
      .map((p) => ({
        date: p.date as string,
        note: (p.description as string) || 'Labor',
        amount: Number(p.amount || 0),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }
  const paid = history.reduce((s, h) => s + h.amount, 0)
  const count = history.length

  return (
    <div className="space-y-6 max-w-2xl">
      <BackLink />
      <div className="flex items-start justify-between gap-3">
        <Header name={name} subtitle={subtitle} />
        {username && (
          <Link
            href={`/u/${username}`}
            className="text-sm text-accent hover:underline shrink-0 mt-1"
          >
            View profile
          </Link>
        )}
      </div>

      <SummaryCards count={count} paid={paid} />
      <RatingNotes rating={rating} wouldRehire={wouldRehire} notes={notes} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Payment history</h2>
        {history.length === 0 ? (
          <div className="card card-body text-sm text-muted-foreground">
            No payments logged for this person yet. When you pay them, log it as a Labor expense
            on the piece and tag their name — it&apos;ll show up here.
          </div>
        ) : (
          <div className="card divide-y divide-border">
            {history.map((h, i) => {
              const when = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h.note}</p>
                    <p className="text-xs text-muted-foreground">{when}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0">
                    {formatCurrency(h.amount)}
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

function SummaryCards({ count, paid }: { count: number; paid: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="card card-body">
        <p className="text-2xl font-semibold text-foreground leading-none">{count}</p>
        <p className="text-sm text-muted-foreground mt-1">Payment{count === 1 ? '' : 's'}</p>
      </div>
      <div className="card card-body">
        <p className="text-2xl font-semibold text-foreground leading-none">{formatCurrency(paid)}</p>
        <p className="text-sm text-muted-foreground mt-1">Paid (from your books)</p>
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
