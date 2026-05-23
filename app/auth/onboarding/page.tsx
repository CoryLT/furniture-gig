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
    phone: '',
    state: '',
    city: '',
    paypalEmail: '',
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
      if (!formData.phone.trim()) {
        throw new Error('Phone is required');
      }
      if (!formData.state) {
        throw new Error('Please select a state');
      }
      if (!formData.city) {
        throw new Error('Please select a city');
      }
      if (!formData.paypalEmail.trim()) {
        throw new Error('PayPal email is required');
      }

      // Create or update worker profile
      const { error: upsertError } = await supabase.from('worker_profiles').upsert(
        {
          user_id: user.id,
          full_name: formData.fullName,
          phone: formData.phone,
          state: formData.state,
          city: formData.city,
          paypal_email: formData.paypalEmail,
          onboarding_complete: true,
        },
        { onConflict: 'user_id' }
      );

      if (upsertError) {
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
    <div className="min-h-screen bg-stone-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
            Complete Your Profile
          </h1>
          <p className="text-slate-600 mb-6">
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
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                placeholder="John Doe"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
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

            {/* PayPal Email */}
            <div>
              <label htmlFor="paypalEmail" className="block text-sm font-medium text-slate-700 mb-1">
                PayPal Email
              </label>
              <input
                id="paypalEmail"
                type="email"
                name="paypalEmail"
                value={formData.paypalEmail}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                placeholder="your@paypal.email"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Continue to Agreements'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}