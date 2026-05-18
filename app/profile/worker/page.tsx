'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LocationSelect } from '@/components/ui/location-select';
import { ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function WorkerProfilePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    phone: '',
    state: '',
    city: '',
    paypalEmail: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const supabase = createClient();

  // Load current profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/auth/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('worker_profiles')
          .select('full_name, username, phone, state, city, paypal_email, avatar_url')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (profile) {
          setFormData({
            fullName: profile.full_name || '',
            username: profile.username || '',
            phone: profile.phone || '',
            state: profile.state || '',
            city: profile.city || '',
            paypalEmail: profile.paypal_email || '',
            avatarUrl: profile.avatar_url || '',
          });
        }
      } catch (err: any) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabase, router]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError('Upload failed: ' + (data.error || 'Unknown error'));
        return;
      }

      // Also save the new avatar_url to the worker profile right away
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('worker_profiles')
          .update({ avatar_url: data.url })
          .eq('user_id', user.id);
      }

      setFormData((prev) => ({ ...prev, avatarUrl: data.url }));
      setSuccess('Profile picture updated!');
    } catch (err) {
      setError('Upload error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
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
      if (!formData.paypalEmail.trim()) {
        throw new Error('PayPal email is required');
      }

      // Update worker profile (store username lowercase for consistency)
      const { error: updateError } = await supabase
        .from('worker_profiles')
        .update({
          full_name: formData.fullName,
          username: formData.username.trim().toLowerCase(),
          phone: formData.phone,
          state: formData.state,
          city: formData.city,
          paypal_email: formData.paypalEmail,
          avatar_url: formData.avatarUrl,
        })
        .eq('user_id', user.id);

      if (updateError) {
        // Postgres unique-violation code is 23505
        if (updateError.code === '23505') {
          throw new Error('That username is already taken. Pick a different one.');
        }
        throw updateError;
      }

      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-slate-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/gigs"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to gigs
        </Link>

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-6">
            My Profile
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* Avatar upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Profile Picture
            </label>
            <div className="flex items-end gap-4">
              {formData.avatarUrl ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-stone-200">
                  <Image
                    src={formData.avatarUrl}
                    alt="Profile picture"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-stone-200 flex items-center justify-center">
                  <span className="text-xs text-slate-500">No photo</span>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={uploading}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    className="gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload photo
                  </Button>
                </label>
                <p className="text-xs text-slate-500 mt-2">Max 5MB</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                disabled={saving}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                placeholder="John Doe"
              />
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={saving}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                placeholder="johndoe"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-slate-500">
                Letters, numbers, hyphens, and underscores only. This appears in your public profile URL.
              </p>
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
                disabled={saving}
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
              disabled={saving}
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
                disabled={saving}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                placeholder="your@paypal.email"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" disabled={saving} className="w-full sm:flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link href="/gigs" className="w-full sm:flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Done
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
