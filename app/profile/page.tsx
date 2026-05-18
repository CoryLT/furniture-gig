'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LocationSelect } from '@/components/ui/location-select';
import { ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    // Shared
    username: '',
    avatarUrl: '',
    state: '',
    city: '',
    // Personal (worker fields)
    fullName: '',
    phone: '',
    paypalEmail: '',
    // Business (flipper fields)
    businessName: '',
    bio: '',
    website: '',
    profilePublic: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load profile data from BOTH tables on mount
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

        // Pull from both tables in parallel
        const [workerResult, flipperResult] = await Promise.all([
          supabase
            .from('worker_profiles')
            .select('full_name, username, phone, state, city, paypal_email, avatar_url')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('flipper_profiles')
            .select('username, business_name, bio, city, state, website, avatar_url, profile_public')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        const worker = workerResult.data;
        const flipper = flipperResult.data;

        // Merge into a single form state — prefer worker for shared fields
        // since it's filled out first during signup
        setFormData({
          username: worker?.username || flipper?.username || '',
          avatarUrl: worker?.avatar_url || flipper?.avatar_url || '',
          state: worker?.state || flipper?.state || '',
          city: worker?.city || flipper?.city || '',
          fullName: worker?.full_name || '',
          phone: worker?.phone || '',
          paypalEmail: worker?.paypal_email || '',
          businessName: flipper?.business_name || '',
          bio: flipper?.bio || '',
          website: flipper?.website || '',
          profilePublic: flipper?.profile_public ?? true,
        });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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

      setFormData((prev) => ({ ...prev, avatarUrl: data.url }));
      setSuccess('Profile picture uploaded! Click Save Changes to keep it.');
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

      const response = await fetch('/api/profile/unified-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
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
          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">
            My Profile
          </h1>
          <p className="text-slate-600 mb-6">
            One profile for everything — claiming gigs and posting gigs.
          </p>

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

          {/* Profile Picture */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Profile Picture</h2>
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

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Info */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Personal Info</h2>

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
                  Letters, numbers, hyphens, and underscores only. Appears in your public profile URL.
                </p>
              </div>

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

              <LocationSelect
                selectedState={formData.state}
                selectedCity={formData.city}
                onStateChange={handleStateChange}
                onCityChange={handleCityChange}
                disabled={saving}
              />

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
                <p className="mt-1 text-xs text-slate-500">
                  Where you'll receive payment when you claim and complete a gig.
                </p>
              </div>
            </section>

            {/* About You (for when you post gigs) */}
            <section className="space-y-4 pt-4 border-t border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">About You</h2>
                <p className="text-sm text-slate-600">
                  Shown on your public profile when you post gigs. Optional, but helps workers trust you.
                </p>
              </div>

              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-slate-700 mb-1">
                  Business Name <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  id="businessName"
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                  placeholder="Your business name"
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-slate-700 mb-1">
                  Website <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  id="website"
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">
                  Bio <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={saving}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100 resize-none"
                  placeholder="Tell people about yourself and your work..."
                />
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-md">
                <input
                  id="profilePublic"
                  type="checkbox"
                  name="profilePublic"
                  checked={formData.profilePublic}
                  onChange={handleChange}
                  disabled={saving}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <label htmlFor="profilePublic" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Make my profile public
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    When checked, your profile appears at flipwork.com/flippers/{formData.username || 'your-username'}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
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
