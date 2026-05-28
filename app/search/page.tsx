import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Search, User, Briefcase, ShoppingBag, Hammer } from 'lucide-react'
import SearchPageBar from '@/components/shared/SearchPageBar'

export const dynamic = 'force-dynamic'

interface PersonResult {
  user_id: string
  full_name: string
  username: string | null
  avatar_url: string
}
interface ServiceResult {
  id: string
  blurb: string
  worker_user_id: string
  categoryLabel: string
  workerName: string
  workerUsername: string | null
  profilePublic?: boolean
}
interface ListingResult {
  id: string
  slug: string
  title: string
}
interface GigResult {
  id: string
  slug: string
  title: string
  summary: string
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = createClient()
  const q = (searchParams?.q ?? '').trim()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  let people: PersonResult[] = []
  let services: ServiceResult[] = []
  let listings: ListingResult[] = []
  let gigs: GigResult[] = []

  if (q.length >= 2) {
    const like = `%${q}%`

    // People — match name or username, public profiles only
    const { data: peopleData } = await supabase
      .from('worker_profiles')
      .select('user_id, full_name, username, avatar_url')
      .eq('profile_public', true)
      .or(`full_name.ilike.${like},username.ilike.${like}`)
      .limit(12)
    people = ((peopleData as PersonResult[] | null) ?? []).filter(
      (p) => !!p.username
    )

    // Services — match category label or blurb. Two-step: find matching
    // category ids, then services by category OR by blurb text.
    const { data: catData } = await supabase
      .from('service_categories')
      .select('id, label')
      .ilike('label', like)
      .eq('active', true)
    const matchingCatIds = ((catData as Array<{ id: string }> | null) ?? []).map(
      (c) => c.id
    )

    let serviceRows: any[] = []
    const orClauses: string[] = [`blurb.ilike.${like}`]
    if (matchingCatIds.length > 0) {
      orClauses.push(`category_id.in.(${matchingCatIds.join(',')})`)
    }
    const { data: svcData } = await supabase
      .from('worker_services')
      .select('id, blurb, worker_user_id, category:service_categories(label)')
      .eq('active', true)
      .or(orClauses.join(','))
      .limit(20)
    serviceRows = (svcData as any[]) ?? []

    // Look up the worker profiles for those services separately
    const svcWorkerIds = Array.from(
      new Set(serviceRows.map((s) => s.worker_user_id))
    )
    const svcWorkerById = new Map<
      string,
      { full_name: string; username: string | null; profile_public: boolean }
    >()
    if (svcWorkerIds.length > 0) {
      const { data: wps } = await supabase
        .from('worker_profiles')
        .select('user_id, full_name, username, profile_public')
        .in('user_id', svcWorkerIds)
      for (const wp of (wps as any[]) ?? []) {
        svcWorkerById.set(wp.user_id, {
          full_name: wp.full_name,
          username: wp.username,
          profile_public: wp.profile_public,
        })
      }
    }

    services = serviceRows
      .map((s) => {
        const cat = Array.isArray(s.category) ? s.category[0] : s.category
        const wk = svcWorkerById.get(s.worker_user_id)
        return {
          id: s.id,
          blurb: s.blurb || '',
          worker_user_id: s.worker_user_id,
          categoryLabel: cat?.label || 'Service',
          workerName: (wk?.full_name || '').trim() || 'A worker',
          workerUsername: wk?.username || null,
          profilePublic: wk?.profile_public !== false,
        }
      })
      .filter((s) => s.profilePublic && !!s.workerUsername)
      .slice(0, 12)

    // Listings — active only, match title or description
    const { data: listingData } = await supabase
      .from('marketplace_listings')
      .select('id, slug, title')
      .eq('status', 'active')
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(12)
    listings = (listingData as ListingResult[] | null) ?? []

    // Gigs — open only, match title or summary
    const { data: gigData } = await supabase
      .from('gigs')
      .select('id, slug, title, summary')
      .eq('status', 'open')
      .or(`title.ilike.${like},summary.ilike.${like}`)
      .limit(12)
    gigs = (gigData as GigResult[] | null) ?? []
  }

  const totalResults =
    people.length + services.length + listings.length + gigs.length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <SearchPageBar initialQuery={q} />
      <div>
        <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
          <Search className="w-6 h-6 text-accent" />
          {q ? `Results for “${q}”` : 'Search'}
        </h1>
        {q && (
          <p className="text-sm text-muted-foreground mt-1">
            {totalResults === 0
              ? 'No matches found.'
              : `${totalResults} result${totalResults === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      {!isLoggedIn && q && totalResults > 0 && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
          <Link href="/auth/login" className="font-semibold underline">
            Log in
          </Link>{' '}
          or{' '}
          <Link href="/auth/signup" className="font-semibold underline">
            sign up
          </Link>{' '}
          to message people, contact servicers, or claim gigs.
        </div>
      )}

      {q.length < 2 && (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      )}

      {/* People */}
      {people.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <User className="w-4 h-4 text-accent" /> People
          </h2>
          <div className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden bg-white">
            {people.map((p) => {
              const name = (p.full_name || '').trim() || 'User'
              const inner = (
                <div className="flex items-center gap-3 p-3 hover:bg-stone-50 transition-colors">
                  {p.avatar_url ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-stone-200">
                      <Image src={p.avatar_url} alt={name} fill sizes="40px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-medium">
                      {name.split(' ').map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || <User className="w-5 h-5" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{name}</p>
                    {p.username && (
                      <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                    )}
                  </div>
                </div>
              )
              return p.username ? (
                <Link key={p.user_id} href={`/u/${p.username}`}>{inner}</Link>
              ) : (
                <div key={p.user_id}>{inner}</div>
              )
            })}
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent" /> Services
          </h2>
          <div className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden bg-white">
            {services.map((s) => {
              const inner = (
                <div className="p-3 hover:bg-stone-50 transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{s.categoryLabel}</span>
                    <span className="text-xs text-muted-foreground">by {s.workerName}</span>
                  </div>
                  {s.blurb && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.blurb}</p>
                  )}
                </div>
              )
              return s.workerUsername ? (
                <Link key={s.id} href={`/u/${s.workerUsername}`}>{inner}</Link>
              ) : (
                <div key={s.id}>{inner}</div>
              )
            })}
          </div>
        </section>
      )}

      {/* Listings */}
      {listings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-accent" /> Listings
          </h2>
          <div className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden bg-white">
            {listings.map((l) => (
              <Link key={l.id} href={`/marketplace/${l.slug}`}>
                <div className="p-3 hover:bg-stone-50 transition-colors">
                  <p className="font-medium text-foreground truncate">{l.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Gigs */}
      {gigs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Hammer className="w-4 h-4 text-accent" /> Gigs
          </h2>
          <div className="divide-y divide-stone-200 border border-stone-200 rounded-lg overflow-hidden bg-white">
            {gigs.map((g) => (
              <Link key={g.id} href={`/gigs/${g.slug}`}>
                <div className="p-3 hover:bg-stone-50 transition-colors">
                  <p className="font-medium text-foreground truncate">{g.title}</p>
                  {g.summary && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{g.summary}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
