'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2, Pencil, X } from 'lucide-react';
import Link from 'next/link';

const MAX_SERVICES = 10;

type Category = {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
};

type Service = {
  id: string;
  category_id: string;
  blurb: string;
  price_type: 'flat' | 'hourly' | 'starting_at' | 'contact_for_quote';
  price_amount: number | null;
  sort_order: number;
  active: boolean;
  // joined
  category?: Category;
};

const PRICE_TYPE_LABELS: Record<Service['price_type'], string> = {
  flat: 'Flat rate',
  hourly: 'Hourly',
  starting_at: 'Starting at',
  contact_for_quote: 'Contact for quote',
};

function formatPrice(s: Service): string {
  if (s.price_type === 'contact_for_quote') return 'Contact for quote';
  const amt = s.price_amount ? `$${Number(s.price_amount).toFixed(2)}` : '';
  if (s.price_type === 'flat') return amt ? `${amt} flat` : 'Flat rate';
  if (s.price_type === 'hourly') return amt ? `${amt}/hr` : 'Hourly';
  if (s.price_type === 'starting_at') return amt ? `Starting at ${amt}` : 'Starting at';
  return '';
}

export default function WorkerServicesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Form state for adding / editing
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBlurb, setFormBlurb] = useState('');
  const [formPriceType, setFormPriceType] = useState<Service['price_type']>('contact_for_quote');
  const [formPriceAmount, setFormPriceAmount] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/auth/login');
          return;
        }

        // Load categories (public read, no auth needed but RLS allows it)
        const { data: cats, error: catsError } = await supabase
          .from('service_categories')
          .select('id, slug, label, sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true });

        if (catsError) throw catsError;
        setCategories(cats || []);

        // Load this worker's services with category joined
        const { data: svcs, error: svcsError } = await supabase
          .from('worker_services')
          .select('id, category_id, blurb, price_type, price_amount, sort_order, active, category:service_categories(id, slug, label, sort_order)')
          .eq('worker_user_id', user.id)
          .order('sort_order', { ascending: true });

        if (svcsError) throw svcsError;
        // Supabase returns category as an array; normalize to object
        const normalized = (svcs || []).map((s: any) => ({
          ...s,
          category: Array.isArray(s.category) ? s.category[0] : s.category,
        }));
        setServices(normalized);
      } catch (err: any) {
        setError(err?.message || 'Failed to load services');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase, router]);

  function resetForm() {
    setEditingId(null);
    setFormCategoryId('');
    setFormBlurb('');
    setFormPriceType('contact_for_quote');
    setFormPriceAmount('');
    setShowForm(false);
  }

  function startAdd() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setFormCategoryId(s.category_id);
    setFormBlurb(s.blurb || '');
    setFormPriceType(s.price_type);
    setFormPriceAmount(s.price_amount != null ? String(s.price_amount) : '');
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formCategoryId) {
      setError('Pick a category.');
      return;
    }
    if (formBlurb.length > 300) {
      setError('Blurb must be 300 characters or fewer.');
      return;
    }

    let priceAmount: number | null = null;
    if (formPriceType !== 'contact_for_quote') {
      if (!formPriceAmount.trim()) {
        setError('Enter a price amount, or change pricing to "Contact for quote".');
        return;
      }
      const parsed = parseFloat(formPriceAmount);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError('Price must be a positive number.');
        return;
      }
      priceAmount = parsed;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (editingId) {
        // Update existing
        const { error: upErr } = await supabase
          .from('worker_services')
          .update({
            category_id: formCategoryId,
            blurb: formBlurb,
            price_type: formPriceType,
            price_amount: priceAmount,
          })
          .eq('id', editingId);
        if (upErr) throw upErr;
        setSuccess('Service updated.');
      } else {
        // Insert new — check the 10 limit client-side first for a nicer error
        if (services.length >= MAX_SERVICES) {
          setError(`You can list a maximum of ${MAX_SERVICES} services.`);
          setSaving(false);
          return;
        }
        // Check duplicate category client-side
        if (services.some((s) => s.category_id === formCategoryId)) {
          setError('You already have a service in that category. Edit the existing one instead.');
          setSaving(false);
          return;
        }
        const { error: insErr } = await supabase.from('worker_services').insert({
          worker_user_id: user.id,
          category_id: formCategoryId,
          blurb: formBlurb,
          price_type: formPriceType,
          price_amount: priceAmount,
          sort_order: services.length,
        });
        if (insErr) throw insErr;
        setSuccess('Service added.');
      }

      // Reload services
      const { data: svcs } = await supabase
        .from('worker_services')
        .select('id, category_id, blurb, price_type, price_amount, sort_order, active, category:service_categories(id, slug, label, sort_order)')
        .eq('worker_user_id', user.id)
        .order('sort_order', { ascending: true });
      const normalized = (svcs || []).map((s: any) => ({
        ...s,
        category: Array.isArray(s.category) ? s.category[0] : s.category,
      }));
      setServices(normalized);
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save service.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this service?')) return;
    setError('');
    setSuccess('');
    try {
      const { error: delErr } = await supabase
        .from('worker_services')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      setServices((prev) => prev.filter((s) => s.id !== id));
      setSuccess('Service removed.');
    } catch (err: any) {
      setError(err?.message || 'Failed to remove service.');
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-stone-500">Loading…</div>
      </div>
    );
  }

  // Categories the worker hasn't used yet (for the add form dropdown)
  const usedCategoryIds = new Set(
    services
      .filter((s) => s.id !== editingId)
      .map((s) => s.category_id)
  );
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id));

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/profile/worker"
          className="inline-flex items-center text-sm text-stone-600 hover:text-stone-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to edit profile
        </Link>

        <header className="mb-6">
          <h1 className="text-3xl font-serif">Services I Offer</h1>
          <p className="text-stone-600 mt-1">
            Show up to {MAX_SERVICES} services on your public profile.
            <span className="ml-2 text-stone-500">
              {services.length} of {MAX_SERVICES} used
            </span>
          </p>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
            {success}
          </div>
        )}

        {/* Existing services */}
        <div className="space-y-3 mb-6">
          {services.length === 0 && !showForm && (
            <div className="p-6 border border-dashed border-stone-300 rounded-lg text-center text-stone-500">
              You haven&apos;t added any services yet.
            </div>
          )}

          {services.map((s) => (
            <div
              key={s.id}
              className="p-4 bg-white rounded-lg border border-stone-200 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{s.category?.label || 'Uncategorized'}</span>
                  <span className="text-stone-400 text-sm">·</span>
                  <span className="text-sm text-stone-700">{formatPrice(s)}</span>
                </div>
                {s.blurb && (
                  <p className="text-sm text-stone-600 mt-1 whitespace-pre-wrap break-words">
                    {s.blurb}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(s)}
                  className="p-2 rounded hover:bg-stone-100 text-stone-600"
                  aria-label="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-2 rounded hover:bg-red-50 text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add button or form */}
        {!showForm && services.length < MAX_SERVICES && (
          <Button onClick={startAdd} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1" />
            Add Service
          </Button>
        )}

        {!showForm && services.length >= MAX_SERVICES && (
          <p className="text-sm text-stone-500">
            You&apos;ve reached the {MAX_SERVICES}-service limit. Remove one to add another.
          </p>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="p-5 bg-white rounded-lg border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {editingId ? 'Edit service' : 'Add a service'}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="p-1 rounded hover:bg-stone-100 text-stone-500"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Category
              </label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                <option value="">Pick a category…</option>
                {/* If editing, the current category may be in usedCategoryIds for other services; build options accordingly */}
                {(editingId
                  ? categories.filter(
                      (c) =>
                        c.id === formCategoryId ||
                        !services
                          .filter((s) => s.id !== editingId)
                          .some((s) => s.category_id === c.id)
                    )
                  : availableCategories
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Blurb */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Short description{' '}
                <span className="text-stone-400 font-normal">
                  (optional, {formBlurb.length}/300)
                </span>
              </label>
              <textarea
                value={formBlurb}
                onChange={(e) => setFormBlurb(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. I specialize in chalk paint and distressed finishes."
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Pricing
                </label>
                <select
                  value={formPriceType}
                  onChange={(e) =>
                    setFormPriceType(e.target.value as Service['price_type'])
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="flat">Flat rate</option>
                  <option value="hourly">Hourly</option>
                  <option value="starting_at">Starting at</option>
                  <option value="contact_for_quote">Contact for quote</option>
                </select>
              </div>
              {formPriceType !== 'contact_for_quote' && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={formPriceAmount}
                    onChange={(e) => setFormPriceAmount(e.target.value)}
                    placeholder="50"
                    className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={saving} loading={saving}>
                {editingId ? 'Save changes' : 'Add service'}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
