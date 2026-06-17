'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LocationSelect } from '@/components/ui/location-select';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Forward ?next= so it survives through to /auth/agreements (the page
  // after this) and then to wherever the user originally wanted to land.
  const rawNext = searchParams.get('next') ?? '';
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('/auth') && !rawNext.startsWith('/admin')
      ? rawNext
      : null;

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    phone: '',
    state: '',
    city: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleStateChange = (state: string) => {
    setFormData((prev) => ({ ...prev, state, city: '' }));
  };

  const handleCityChange = (city: string) => {
    setFormData((prev) => ({ ...prev, city }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Not authenticated');
      }

      // Validate required fields
      if (!formData.fullName.trim()) {
        throw new Error('Name is required');
      }
      if (!formData.username.trim()) {
        throw new Error('Username is required');
      }
      if (formData.username.trim().length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(formData.username.trim())) {
        throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
      }
      if (!formData.phone.trim()) {
        throw new Error('Phone is required');
      }
      if (!formData.state) {
        throw new Error('Please select a state');
      }
      if (!formData.city) {
        throw new Error('Please select a city');
      }

      // Create or update worker profile
      const { error: upsertError } = await supabase.from('worker_profiles').upsert(
        {
          user_id: user.id,
          full_name: formData.fullName,
          username: formData.username.trim().toLowerCase(),
          phone: formData.phone,
          state: formData.state,
          city: formData.city,
          onboarding_complete: true,
        },
        { onConflict: 'user_id' }
      );

      if (upsertError) {
        // Postgres unique-violation code is 23505 — means the username is taken.
        if (upsertError.code === '23505') {
          throw new Error('That username is already taken. Pick a different one.');
        }
        throw upsertError;
      }

      // Redirect to agreements page, carrying ?next= so the user lands
      // back where they originally wanted to go after accepting agreements.
      const agreementsHref = safeNext
        ? `/auth/agreements?next=${encodeURIComponent(safeNext)}`
        : '/auth/agreements';
      router.push(agreementsHref);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow p-8">
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground mb-6">
            Let us know a bit about yourself before you start taking gigs.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                placeholder="John Doe"
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                placeholder="johndoe"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Letters, numbers, hyphens, and underscores only. This becomes your public profile link.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* Location Select Component */}
            <LocationSelect
              selectedState={formData.state}
              selectedCity={formData.city}
              onStateChange={handleStateChange}
              onCityChange={handleCityChange}
              disabled={loading}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Continue to Agreements'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}