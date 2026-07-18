'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LocationSelect } from '@/components/ui/location-select';
import { ArrowLeft, Upload, Camera } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { PhotoUploadForm } from '@/components/ui/PhotoUploadForm';
import { PhotoGallery, type GalleryPhoto } from '@/components/ui/PhotoGallery';
import PayoutHandlesSection from '@/components/profile/PayoutHandlesSection';
import BusinessSetupCard from '@/app/home/BusinessSetupCard';
import EnableNotificationsButton from '@/components/notifications/EnableNotificationsButton';
import DeleteAccountCard from '@/components/profile/DeleteAccountCard';
import { compressImageForUpload } from '@/lib/imageCompression';

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
    // Business (flipper fields)
    businessName: '',
    bio: '',
    website: '',
    profilePublic: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
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

        setUserId(user.id);

        // Pull from both tables in parallel
        const [workerResult, flipperResult, workerPhotosResult, flipperPhotosResult] = await Promise.all([
          supabase
            .from('worker_profiles')
            .select('full_name, username, phone, state, city, avatar_url')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('flipper_profiles')
            .select('username, business_name, bio, city, state, website, avatar_url, profile_public')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('worker_photo_galleries')
            .select('*')
            .eq('worker_user_id', user.id)
            .order('display_order', { ascending: true }),
          supabase
            .from('flipper_photo_galleries')
            .select('*')
            .eq('flipper_user_id', user.id)
            .order('display_order', { ascending: true }),
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
          businessName: flipper?.business_name || '',
          bio: flipper?.bio || '',
          website: flipper?.website || '',
          profilePublic: flipper?.profile_public ?? true,
        });

        // Build photo gallery: combine worker + flipper photos with public URLs.
        // Tag each photo with its source so we know which table to delete from.
        const workerPhotos: any[] = (workerPhotosResult.data || []).map((p: any) => ({
          ...p,
          _source: 'worker' as const,
          publicUrl: supabase.storage.from('photo-galleries').getPublicUrl(p.file_path).data.publicUrl,
        }));
        const flipperPhotos: any[] = (flipperPhotosResult.data || []).map((p: any) => ({
          ...p,
          _source: 'flipper' as const,
          publicUrl: supabase.storage.from('photo-galleries').getPublicUrl(p.file_path).data.publicUrl,
        }));
        setPhotos([...workerPhotos, ...flipperPhotos]);
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
      // Compress big photos before upload. Vercel caps function bodies at 4.5MB.
      const fileToUpload = await compressImageForUpload(file);

      const uploadFormData = new FormData();
      uploadFormData.append('file', fileToUpload);

      const response = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: uploadFormData,
      });

      // Vercel's 413 returns HTML, not JSON — guard the parse.
      let data: { url?: string; error?: string } = {};
      try {
        data = await response.json();
      } catch {
        setError(
          response.status === 413
            ? 'Image is too large to upload even after compression. Try a smaller photo.'
            : `Upload failed (server error ${response.status}).`
        );
        setUploading(false);
        return;
      }

      if (!response.ok) {
        setError('Upload failed: ' + (data.error || 'Unknown error'));
        return;
      }

      setFormData((prev) => ({ ...prev, avatarUrl: data.url || '' }));
      setSuccess('Profile picture uploaded! Click Save Changes to keep it.');
    } catch (err) {
      setError('Upload error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    setUploading(false);
  };

  // Refresh photos from the database (called after a new upload)
  const reloadPhotos = async () => {
    if (!userId) return;

    const [workerPhotosResult, flipperPhotosResult] = await Promise.all([
      supabase
        .from('worker_photo_galleries')
        .select('*')
        .eq('worker_user_id', userId)
        .order('display_order', { ascending: true }),
      supabase
        .from('flipper_photo_galleries')
        .select('*')
        .eq('flipper_user_id', userId)
        .order('display_order', { ascending: true }),
    ]);

    const workerPhotos: any[] = (workerPhotosResult.data || []).map((p: any) => ({
      ...p,
      _source: 'worker' as const,
      publicUrl: supabase.storage.from('photo-galleries').getPublicUrl(p.file_path).data.publicUrl,
    }));
    const flipperPhotos: any[] = (flipperPhotosResult.data || []).map((p: any) => ({
      ...p,
      _source: 'flipper' as const,
      publicUrl: supabase.storage.from('photo-galleries').getPublicUrl(p.file_path).data.publicUrl,
    }));
    setPhotos([...workerPhotos, ...flipperPhotos]);
  };

  // Delete a photo. We figure out which table to delete from based on the photo's _source tag.
  // The PhotoGallery component passes a 'type' arg, but we ignore it and use _source instead
  // since some photos live in the worker table and some in the flipper table.
  const handleDeletePhoto = async (photoId: string, _type: 'worker' | 'flipper') => {
    // Find the photo to know which source table it came from
    const photo = photos.find((p) => p.id === photoId) as any;
    if (!photo) throw new Error('Photo not found');

    const type = photo._source as 'worker' | 'flipper';

    const response = await fetch('/api/delete-gallery-photo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, type }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete photo');
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
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
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/gigs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to gigs
        </Link>

        <div className="bg-card rounded-lg shadow p-8">
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
            My Profile
          </h1>
          <p className="text-muted-foreground mb-6">
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
            <h2 className="text-lg font-semibold text-foreground mb-3">Profile Picture</h2>
            <div className="flex items-end gap-4">
              {formData.avatarUrl ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={formData.avatarUrl}
                    alt="Profile picture"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">No photo</span>
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
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
                <p className="text-xs text-muted-foreground mt-2">Max 5MB</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Info */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Personal Info</h2>

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
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                  placeholder="John Doe"
                />
              </div>

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
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                  placeholder="johndoe"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Letters, numbers, hyphens, and underscores only. Appears in your public profile URL.
                </p>
              </div>

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
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
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
            </section>

            {/* About You (for when you post gigs) */}
            <section className="space-y-4 pt-4 border-t border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">About You</h2>
                <p className="text-sm text-muted-foreground">
                  Shown on your public profile when you post gigs. Optional, but helps workers trust you.
                </p>
              </div>

              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-foreground mb-1">
                  Business Name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="businessName"
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                  placeholder="Your business name"
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-foreground mb-1">
                  Website <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="website"
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted"
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1">
                  Bio <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={saving}
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent disabled:bg-muted resize-none"
                  placeholder="Tell people about yourself and your work..."
                />
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
                <input
                  id="profilePublic"
                  type="checkbox"
                  name="profilePublic"
                  checked={formData.profilePublic}
                  onChange={handleChange}
                  disabled={saving}
                  className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <div>
                  <label htmlFor="profilePublic" className="text-sm font-medium text-foreground cursor-pointer">
                    Make my profile public
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    When checked, your profile appears at flipwork.com/u/{formData.username || 'your-username'}
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

        {/* How you get paid — direct pay handles (Cash App/Venmo/etc.) */}
        <PayoutHandlesSection />

        {/* Your business — appears here once setup is complete on the dashboard */}
        {userId && (
          <div className="mt-6">
            <BusinessSetupCard userId={userId} mode="settings" />
          </div>
        )}

        {/* Notifications — manage the phone buzz (and send a test) here */}
        <div className="bg-card rounded-lg shadow p-8 mt-6">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-4">
            Notifications
          </h2>
          <EnableNotificationsButton placement="settings" />
        </div>

        {/* Add to Home Screen — persistent link to the install guide */}
        <div className="bg-card rounded-lg shadow p-8 mt-6">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
            Add to Home Screen
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Install FlipWork on your phone for a one-tap icon, full-screen use, and notifications.
          </p>
          <Link
            href="/install"
            className="inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent/90"
          >
            See how to add it
          </Link>
        </div>

        {/* FlipWork Pro */}
        <div className="bg-card rounded-lg shadow p-8 mt-6">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
            FlipWork Pro
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Unlock the receipt scanner, tax-year summary, and 1099 tracking — and the Pro tools
            coming next.
          </p>
          <Link
            href="/upgrade"
            className="inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:bg-accent/90"
          >
            See plans
          </Link>
        </div>

        {/* Work Samples Gallery — separate card so it has its own context */}
        <div className="bg-card rounded-lg shadow p-8 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-5 h-5 text-foreground" />
            <h2 className="text-2xl font-serif font-bold text-foreground">
              Work Samples
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Photos of your work. These show up on your public profile in an Instagram-style grid.
          </p>

          <div className="space-y-6">
            <PhotoUploadForm onPhotoUploaded={reloadPhotos} userType="flipper" />

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Your Photos {photos.length > 0 && `(${photos.length})`}
              </h3>
              <PhotoGallery
                photos={photos}
                isEditable={true}
                onDeletePhoto={handleDeletePhoto}
                userType="flipper"
              />
            </div>
          </div>
        </div>

        {/* Danger zone — full account delete lives here so it's the
            last thing on the settings screen and hard to hit by accident. */}
        <DeleteAccountCard />
      </div>
    </div>
  );
}
