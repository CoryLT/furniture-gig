'use client'

import { useMemo, useState } from 'react'
import GigListingCard from './GigListingCard'
import type { GigRow } from '@/types/database'

interface GigFilterContentProps {
  initialGigs: GigRow[]
  workerCity: string | null
  workerState: string | null
  myClaimedIds: Set<string>
  hasLocation: boolean
  currentUserId: string
}

export default function GigFilterContent({
  initialGigs,
  workerCity,
  workerState,
  myClaimedIds,
  currentUserId,
}: GigFilterContentProps) {
  // Pre-fill the filter with the user's home city/state if they have one
  const [selectedState, setSelectedState] = useState<string>(workerState ?? '')
  const [selectedCity, setSelectedCity] = useState<string>(workerCity ?? '')

  // Build state and city options from the gigs we already have, so the
  // dropdowns only show places that actually have at least one open gig.
  const { stateOptions, cityOptions } = useMemo(() => {
    const states = new Set<string>()
    const citiesByState: Record<string, Set<string>> = {}

    for (const gig of initialGigs) {
      if (gig.state) {
        states.add(gig.state)
        if (!citiesByState[gig.state]) citiesByState[gig.state] = new Set()
        if (gig.city) citiesByState[gig.state].add(gig.city)
      }
    }

    const stateList = Array.from(states).sort()
    const cityList = selectedState
      ? Array.from(citiesByState[selectedState] ?? []).sort()
      : []

    return { stateOptions: stateList, cityOptions: cityList }
  }, [initialGigs, selectedState])

  // Apply the filter to the gigs list
  const filteredGigs = useMemo(() => {
    return initialGigs.filter((gig) => {
      if (selectedState && gig.state !== selectedState) return false
      if (selectedCity && gig.city !== selectedCity) return false
      return true
    })
  }, [initialGigs, selectedState, selectedCity])

  const isFiltering = !!(selectedState || selectedCity)

  function handleStateChange(state: string) {
    setSelectedState(state)
    // Reset city when state changes
    setSelectedCity('')
  }

  function clearFilter() {
    setSelectedState('')
    setSelectedCity('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-foreground">Browse Gigs</h1>
        <p className="text-muted-foreground mt-1">
          Find furniture flipping projects near you.
        </p>
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="filter-state" className="field-label">State</label>
              <select
                id="filter-state"
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="field-input"
              >
                <option value="">All states</option>
                {stateOptions.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="filter-city" className="field-label">City</label>
              <select
                id="filter-city"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={!selectedState}
                className="field-input"
              >
                <option value="">
                  {selectedState ? 'All cities in this state' : 'Pick a state first'}
                </option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filteredGigs.length}</span>{' '}
              {filteredGigs.length === 1 ? 'gig' : 'gigs'}
              {isFiltering ? ' found' : ' available'}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={clearFilter}
                className="text-sm text-accent hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gig list */}
      {filteredGigs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            {initialGigs.length === 0 ? (
              <>
                <p className="text-foreground font-medium">
                  FlipWork just launched.
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Gigs are still rolling in. Check back soon — or be one of the
                  first to post a project and have flippers fight over it.
                </p>
              </>
            ) : (
              <>
                <p className="text-foreground font-medium">
                  No gigs match this filter
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different city or clear the filter to see all open gigs.
                </p>
                <button
                  type="button"
                  onClick={clearFilter}
                  className="mt-4 text-sm text-accent hover:underline"
                >
                  Clear filter
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGigs.map((gig) => (
            <GigListingCard
              key={gig.id}
              gig={gig}
              isClaimed={myClaimedIds.has(gig.id)}
              isOwnPost={
                gig.poster_user_id === currentUserId ||
                gig.created_by === currentUserId
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
