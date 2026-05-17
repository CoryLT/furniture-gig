'use client';

import { useEffect, useState } from 'react';

interface LocationSelectProps {
  selectedState: string;
  selectedCity: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  disabled?: boolean;
}

interface Option {
  value: string;
  label: string;
}

const stateMap: Record<string, string> = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
};

export function LocationSelect({
  selectedState,
  selectedCity,
  onStateChange,
  onCityChange,
  disabled = false,
}: LocationSelectProps) {
  const [states, setStates] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  // Load states on mount
  useEffect(() => {
    async function loadStates() {
      try {
        const response = await fetch('/api/locations/states');
        const data = await response.json();
        setStates(data);
      } catch (error) {
        console.error('Failed to load states:', error);
      } finally {
        setLoadingStates(false);
      }
    }
    loadStates();
  }, []);

  // Load cities when state changes
  useEffect(() => {
    if (!selectedState) {
      setCities([]);
      return;
    }

    async function loadCities() {
      setLoadingCities(true);
      try {
        const response = await fetch(`/api/locations/cities?state=${selectedState}`);
        const data = await response.json();
        setCities(data);
        // Reset city selection if it's no longer valid for the new state
        if (selectedCity && !data.find((c: Option) => c.value === selectedCity)) {
          onCityChange('');
        }
      } catch (error) {
        console.error('Failed to load cities:', error);
      } finally {
        setLoadingCities(false);
      }
    }

    loadCities();
  }, [selectedState, selectedCity, onCityChange]);

  return (
    <div className="space-y-4">
      {/* State Select */}
      <div>
        <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-2">
          State
        </label>
        <select
          id="state"
          value={selectedState}
          onChange={(e) => {
            onStateChange(e.target.value);
            onCityChange(''); // Reset city when state changes
          }}
          disabled={disabled || loadingStates}
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
        >
          <option value="">Select a state...</option>
          {states.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
      </div>

      {/* City Select */}
      <div>
        <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-2">
          City
        </label>
        <select
          id="city"
          value={selectedCity}
          onChange={(e) => onCityChange(e.target.value)}
          disabled={disabled || !selectedState || loadingCities}
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
        >
          <option value="">
            {loadingCities ? 'Loading cities...' : 'Select a city...'}
          </option>
          {cities.map((city) => (
            <option key={city.value} value={city.value}>
              {city.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}