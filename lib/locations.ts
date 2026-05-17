import { createClient } from '@/lib/supabase/server';

/**
 * Fetch all unique states from supported_locations
 * Returns array of {value: 'CA', label: 'California'}
 */
export async function fetchStates() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('supported_locations')
    .select('state')
    .order('state', { ascending: true });

  if (error) {
    console.error('Error fetching states:', error);
    return [];
  }

  // Get unique states and map to display format
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

  const uniqueStates = Array.from(new Set(data.map((row) => row.state)));

  return uniqueStates.map((state) => ({
    value: state,
    label: stateMap[state] || state,
  }));
}

/**
 * Fetch all cities for a given state
 * Returns array of {value: 'Los Angeles', label: 'Los Angeles'}
 */
export async function fetchCitiesByState(state: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('supported_locations')
    .select('city')
    .eq('state', state)
    .order('city', { ascending: true });

  if (error) {
    console.error('Error fetching cities:', error);
    return [];
  }

  return data.map((row) => ({
    value: row.city,
    label: row.city,
  }));
}

/**
 * Validate that a state/city combo exists in supported_locations
 * Used for form submission validation
 */
export async function validateLocation(state: string, city: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('supported_locations')
    .select('id')
    .eq('state', state)
    .eq('city', city)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}
