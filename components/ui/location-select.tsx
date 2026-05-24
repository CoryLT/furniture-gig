'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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

export function LocationSelect({
  selectedState,
  selectedCity,
  onStateChange,
  onCityChange,
  disabled = false,
}: LocationSelectProps) {
  const [states, setStates] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load states and cities on mount
  useEffect(() => {
    async function loadData() {
      // Defined inside the hook to avoid Next.js production minification
      // stripping module-level constants. See handoff notes.
      const stateMap: Record<string, string> = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
        'WI': 'Wisconsin', 'WY': 'Wyoming',
      };
      try {
        const { data, error } = await supabase
          .from('supported_locations')
          .select('state, city')
          .order('state', { ascending: true });

        if (error || !data) {
          console.error('Failed to load locations:', error);
          setLoading(false);
          return;
        }

        // Get unique states
        const uniqueStates = Array.from(new Set(data.map((row) => row.state)));
        const statesOptions = uniqueStates.map((state) => ({
          value: state,
          label: stateMap[state] || state,
        }));
        setStates(statesOptions);
      } catch (error) {
        console.error('Error loading locations:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);

  // Load cities when state changes
  useEffect(() => {
    if (!selectedState) {
      setCities([]);
      return;
    }

    async function loadCities() {
      try {
        const { data, error } = await supabase
          .from('supported_locations')
          .select('city')
          .eq('state', selectedState)
          .order('city', { ascending: true });

        if (error || !data) {
          console.error('Failed to load cities:', error);
          return;
        }

        const citiesOptions = data.map((row) => ({
          value: row.city,
          label: row.city,
        }));
        setCities(citiesOptions);

        // Reset city if no longer valid
        if (selectedCity && !citiesOptions.find((c) => c.value === selectedCity)) {
          onCityChange('');
        }
      } catch (error) {
        console.error('Error loading cities:', error);
      }
    }

    loadCities();
  }, [selectedState, selectedCity, onCityChange, supabase]);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <label htmlFor="state" className="field-label">State</label>
        <select
          id="state"
          value={selectedState}
          onChange={(e) => {
            onStateChange(e.target.value);
            onCityChange('');
          }}
          disabled={disabled || loading}
          className="field-input"
          required
        >
          <option value="">—</option>
          {states.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label htmlFor="city" className="field-label">City</label>
        <select
          id="city"
          value={selectedCity}
          onChange={(e) => onCityChange(e.target.value)}
          disabled={disabled || !selectedState}
          className="field-input"
          required
        >
          <option value="">{selectedState ? 'Select a city...' : 'Pick a state first'}</option>
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