import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const state = request.nextUrl.searchParams.get('state');

    if (!state) {
      return NextResponse.json({ error: 'State is required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('supported_locations')
      .select('city')
      .eq('state', state)
      .order('city', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.warn(`No cities found for state: ${state}`);
      return NextResponse.json([]);
    }

    const cities = data.map((row) => ({
      value: row.city,
      label: row.city,
    }));

    return NextResponse.json(cities);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
  }
}