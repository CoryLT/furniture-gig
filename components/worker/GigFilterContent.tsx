'use client'

import { useState, useMemo } from 'react'
import GigListingCard from '@/components/worker/GigListingCard'
import GigCityFilter from '@/components/worker/GigCityFilter'
import { getNearbyCity } from '@/lib/locationData'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Gig {
  id: string
  slug: string
  title: string
  city: string
  state: string
  pay_amount: number
  due_date: string | null
  [key: string]: unknown
}

interface GigFilterContentProps {
  initialGigs: Gig[]
  workerCity: string | null
  workerState: string | null
  myClaimedIds: Set<string>
  hasLocation: boolean
}

export default function GigFilterContent({
  initialGigs,
  workerCity,
  workerState,
  myClaimedIds,
  hasLocation,
}: GigFilterContentProps) {
  // Default to worker's home city if they have one
  const [selectedCity, setSelectedCity] = useState<string | null>(workerCity)

  // Filter gigs based on selected city + nearby cities
  const filteredGigs = useMemo(() => {
    if (!selectedCity) {
      return initialGigs
    }

    const nearbyCities = getNearbyCity(selectedCity)
    return initialGigs.filter((gig) => {
     // Extract city from location_text or use gig.city
const gigCity = (gig.location_text?.split(',')?.[0]?.trim() || gig.city || '').toLowerCase()
return nearbyCities.some((city) => city.toLowerCase() === gigCity)
  }, [selectedCity, initialGigs])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-foreground">Available Gigs</h1>
          <p className="text-muted-foreground mt-1">
            {selectedCity
              ? `${filteredGigs.length} open ${filteredGigs.length === 1 ? 'gig' : 'gigs'} near ${selectedCity}`
              : `${filteredGigs.length} open ${filteredGigs.length === 1 ? 'gig' : 'gigs'}`
            }
          </p>
        </div>
      </div>

      {/* City filter */}
      {hasLocation && (
        <GigCityFilter
          currentCity={selectedCity}
          currentState={workerState}
          onCityChange={setSelectedCity}
          totalGigs={filteredGigs.length}
        />
      )}

      {/* No location set banner */}
      {!hasLocation && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Your profile doesn&apos;t have a city and state set yet, so you&apos;re seeing all gigs.{' '}
            <Link href="/auth/onboarding" className="underline font-medium">
              Update your profile
            </Link>{' '}
            to see only local gigs.
          </span>
        </div>
      )}

      {/* Empty state */}
      {(!filteredGigs || filteredGigs.length === 0) && (
        <div className="card card-body text-center py-16 space-y-2">
          <p className="text-lg text-muted-foreground">
            No gigs available{selectedCity ? ` near ${selectedCity}` : ''} right now.
          </p>
          <p className="text-sm text-muted-foreground">Check back soon — new projects get posted regularly.</p>
        </div>
      )}

      {/* Gig grid */}
      {filteredGigs && filteredGigs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGigs.map((gig) => (
            <GigListingCard key={gig.id} gig={gig} isClaimed={myClaimedIds.has(gig.id)} />
          ))}
        </div>
      )}
    </div>
  )
}