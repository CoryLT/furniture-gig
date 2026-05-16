'use client'

import { useState, useEffect } from 'react'
import { CITIES_BY_STATE, getNearbyCity } from '@/lib/locationData'
import { ChevronDown } from 'lucide-react'

interface GigCityFilterProps {
  currentCity: string | null
  currentState: string | null
  onCityChange: (city: string) => void
  totalGigs: number
}

export default function GigCityFilter({
  currentCity,
  currentState,
  onCityChange,
  totalGigs,
}: GigCityFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState<string | null>(currentCity)
  const [nearbyCount, setNearbyCount] = useState(0)

  // Get the list of cities for the worker's state
  const stateCities = currentState ? CITIES_BY_STATE[currentState] ?? [] : []

  // When selected city changes, update nearby count
  useEffect(() => {
    if (selectedCity) {
      const nearby = getNearbyCity(selectedCity)
      setNearbyCount(nearby.length)
    }
  }, [selectedCity])

  const handleCitySelect = (city: string) => {
    setSelectedCity(city)
    onCityChange(city)
    setIsOpen(false)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-4 py-2 text-left bg-white border border-stone-200 rounded-lg hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center justify-between"
          >
            <span className="font-medium text-foreground">
              {selectedCity || 'Select a city'}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
              {stateCities.length > 0 ? (
                stateCities.map((city) => (
                  <button
                    key={city}
                    onClick={() => handleCitySelect(city)}
                    className={`w-full px-4 py-2 text-left hover:bg-stone-100 transition-colors ${
                      selectedCity === city ? 'bg-amber-50 border-l-2 border-amber-500 font-medium' : ''
                    }`}
                  >
                    {city}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-muted-foreground">No cities available</div>
              )}
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{totalGigs}</span> gig{totalGigs !== 1 ? 's' : ''}
        </div>
      </div>

      {selectedCity && nearbyCount > 1 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing gigs in {selectedCity} and {nearbyCount - 1} nearby {nearbyCount - 1 === 1 ? 'city' : 'cities'}
        </p>
      )}
    </div>
  )
}