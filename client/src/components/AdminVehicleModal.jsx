import {
  AlertCircle,
  ImagePlus,
  Link2,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { formatFileSize, optimizeImageForUpload } from '../lib/imageOptimize';
import { VehiclePhoto } from './VehiclePhoto';

function buildInitialForm(vehicle) {
  return {
    name: vehicle?.name || '',
    model: vehicle?.model || '',
    year: vehicle?.year ? String(vehicle.year) : '',
    sortOrder: vehicle?.sortOrder ?? 0,
    isPublished: vehicle ? Boolean(vehicle.isPublished) : true,
    isFeatured: vehicle ? Boolean(vehicle.isFeatured) : false,
    categories: (vehicle?.categories || []).map((c) =>
      typeof c === 'string' ? c : c._id
    ),
    summary: vehicle?.summary || '',
    description: vehicle?.description || '',
    specs: {
      seats:
        vehicle?.specs?.seats !== null && vehicle?.specs?.seats !== undefined
          ? String(vehicle.specs.seats)
          : '',
      transmission: vehicle?.specs?.transmission || 'Automatic',
      luggage: vehicle?.specs?.luggage || '',
      chauffeur: vehicle?.specs?.chauffeur || 'Chauffeur Included',
      fuelType: vehicle?.specs?.fuelType || '',
      airConditioning: vehicle?.specs?.airConditioning ?? true,
    },
    highlightsText: (vehicle?.highlights || []).join('\n'),
    photos: (vehicle?.photos || []).map((p) => ({
      url: p.url,
      alt: p.alt || '',
      storageProvider: p.storageProvider || 'external',
      mediaId: p.mediaId || '',
      isPrimary: Boolean(p.isPrimary),
    })),
  };
}

export function AdminVehicleModal({
  vehicle,
  categories = [],
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(vehicle?._id);
  const [form, setForm] = useState(() => buildInitialForm(vehicle));
  const [externalUrl, setExternalUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadInfo, setUploadInfo] = useState('');

  useEffect(() => {
    const prevOverflow =
      typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !saving && !uploading) {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [saving, uploading, onClose]);

  const toggleCategory = (catId) => {
    setForm((prev) => {
      const exists = prev.categories.includes(catId);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((id) => id !== catId)
          : [...prev.categories, catId],
      };
    });
  };

  const handleFileUpload = async (e, { replacePrimary = false } = {}) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selectedFiles.length) return;

    setUploading(true);
    setError('');
    setUploadInfo('');

    try {
      const formData = new FormData();
      let originalBytes = 0;
      let optimizedBytes = 0;

      for (const rawFile of selectedFiles) {
        originalBytes += rawFile.size;
        const optimized = await optimizeImageForUpload(rawFile);
        optimizedBytes += optimized.size;
        formData.append('photos', optimized, optimized.name);
      }

      const data = await apiFetch('/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });

      const uploaded = (data.photos || []).map((p, idx) => ({
        ...p,
        isPrimary: replacePrimary ? idx === 0 : false,
      }));

      setForm((prev) => {
        if (replacePrimary && uploaded.length > 0) {
          const rest = prev.photos
            .filter((p) => !p.isPrimary)
            .map((p) => ({ ...p, isPrimary: false }));
          return { ...prev, photos: [uploaded[0], ...uploaded.slice(1), ...rest] };
        }
        const combined = [...prev.photos, ...uploaded];
        if (combined.length > 0 && !combined.some((p) => p.isPrimary)) {
          combined[0].isPrimary = true;
        }
        return { ...prev, photos: combined };
      });

      const providerLabel =
        data.storageProvider === 'cloudinary'
          ? ' to Cloudinary CDN'
          : data.storageProvider === 'vercel-blob'
            ? ' to Vercel Blob'
            : '';
      setUploadInfo(
        originalBytes > optimizedBytes
          ? `Uploaded ${uploaded.length} photo(s)${providerLabel} — converted to WebP (${formatFileSize(originalBytes)} → ${formatFileSize(optimizedBytes)}).`
          : `Uploaded ${uploaded.length} photo(s)${providerLabel} (${formatFileSize(optimizedBytes)} WebP).`
      );
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddExternalUrl = () => {
    const trimmed = externalUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('/') && !/^https?:\/\//i.test(trimmed)) {
      setError('Image URL must start with https://, http://, or /');
      return;
    }
    setError('');
    setForm((prev) => {
      const next = [
        ...prev.photos,
        {
          url: trimmed,
          alt: prev.name || 'Vehicle photo',
          storageProvider: trimmed.startsWith('/vehicles/') ? 'static' : 'external',
          mediaId: '',
          isPrimary: prev.photos.length === 0,
        },
      ];
      return { ...prev, photos: next };
    });
    setExternalUrl('');
  };

  const setPrimaryPhoto = (idx) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.map((p, i) => ({ ...p, isPrimary: i === idx })),
    }));
  };

  const removePhoto = (idx) => {
    setForm((prev) => {
      const next = prev.photos.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((p) => p.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return { ...prev, photos: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Vehicle name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      model: form.model.trim(),
      year: form.year ? Number(form.year) : null,
      sortOrder: Number(form.sortOrder) || 0,
      isPublished: form.isPublished,
      isFeatured: form.isFeatured,
      categories: form.categories,
      summary: form.summary.trim(),
      description: form.description.trim(),
      specs: {
        seats: form.specs.seats ? Number(form.specs.seats) : null,
        transmission: form.specs.transmission.trim(),
        luggage: form.specs.luggage.trim(),
        chauffeur: form.specs.chauffeur.trim(),
        fuelType: form.specs.fuelType.trim(),
        airConditioning: form.specs.airConditioning,
      },
      highlights: form.highlightsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      photos: form.photos,
    };

    try {
      const endpoint = isEditing
        ? `/api/admin/vehicles/${vehicle._id}`
        : '/api/admin/vehicles';
      const data = await apiFetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        body: payload,
      });
      onSaved?.(data.vehicle);
    } catch (err) {
      setError(err.message || 'Could not save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-vehicle-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
        onClick={() => {
          if (!saving && !uploading) onClose?.();
        }}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border-gold)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h2
            id="admin-vehicle-modal-title"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            {isEditing ? `Edit ${vehicle.name}` : 'Add New Vehicle'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vehicle form"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-500 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* Core Identity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="v-name"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Vehicle Name *
              </label>
              <input
                id="v-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., 2024 Mercedes-Benz S-Class"
                data-testid="vehicle-form-name"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="v-model"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Model / Trim (optional)
              </label>
              <input
                id="v-model"
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g., Mercedes-Benz S 500 AMG Line"
                data-testid="vehicle-form-model"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="v-year"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Model Year (optional)
              </label>
              <input
                id="v-year"
                type="number"
                min="1950"
                max="2100"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2024"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="v-sort"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Display Order (lower appears first)
              </label>
              <input
                id="v-sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>
          </div>

          {/* Publish & Hero Toggles */}
          <div className="flex flex-wrap gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-3.5">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) =>
                  setForm({ ...form, isPublished: e.target.checked })
                }
                data-testid="vehicle-form-published"
                className="h-4 w-4 accent-[#D4AF37]"
              />
              <span>Published (visible on public website)</span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) =>
                  setForm({ ...form, isFeatured: e.target.checked })
                }
                className="h-4 w-4 accent-[#D4AF37]"
              />
              <span>Feature in Desktop Hero Banner</span>
            </label>
          </div>

          {/* Categories */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--gold-accent)]">
              Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const checked = form.categories.includes(cat._id);
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => toggleCategory(cat._id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      checked
                        ? 'btn-gold'
                        : 'pill-gold-outline text-[var(--text-secondary)]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specifications */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--gold-accent)]">
              Specifications
            </p>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="spec-seats"
                  className="mb-1 block text-xs text-[var(--text-secondary)]"
                >
                  Seating Capacity
                </label>
                <input
                  id="spec-seats"
                  type="number"
                  min="1"
                  max="60"
                  value={form.specs.seats}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      specs: { ...form.specs, seats: e.target.value },
                    })
                  }
                  placeholder="e.g., 5"
                  data-testid="vehicle-form-seats"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="spec-trans"
                  className="mb-1 block text-xs text-[var(--text-secondary)]"
                >
                  Transmission
                </label>
                <select
                  id="spec-trans"
                  value={form.specs.transmission}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      specs: { ...form.specs, transmission: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                >
                  <option value="">Not specified</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                  <option value="Tiptronic">Tiptronic</option>
                  <option value="CVT">CVT</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="spec-luggage"
                  className="mb-1 block text-xs text-[var(--text-secondary)]"
                >
                  Luggage Capacity
                </label>
                <input
                  id="spec-luggage"
                  type="text"
                  value={form.specs.luggage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      specs: { ...form.specs, luggage: e.target.value },
                    })
                  }
                  placeholder="e.g., 3 Suitcases"
                  data-testid="vehicle-form-luggage"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="spec-chauffeur"
                  className="mb-1 block text-xs text-[var(--text-secondary)]"
                >
                  Chauffeur Availability
                </label>
                <select
                  id="spec-chauffeur"
                  value={form.specs.chauffeur}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      specs: { ...form.specs, chauffeur: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                >
                  <option value="">Not specified</option>
                  <option value="Chauffeur Included">Chauffeur Included</option>
                  <option value="Chauffeur Available">Chauffeur Available</option>
                  <option value="Self-Drive Only">Self-Drive Only</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="spec-fuel"
                  className="mb-1 block text-xs text-[var(--text-secondary)]"
                >
                  Fuel / Powertrain
                </label>
                <input
                  id="spec-fuel"
                  type="text"
                  value={form.specs.fuelType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      specs: { ...form.specs, fuelType: e.target.value },
                    })
                  }
                  placeholder="e.g., Hybrid, Diesel, Electric"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.specs.airConditioning}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        specs: {
                          ...form.specs,
                          airConditioning: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 accent-[#D4AF37]"
                  />
                  <span>Air Conditioned</span>
                </label>
              </div>
            </div>
          </div>

          {/* Descriptions & Highlights */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label
                htmlFor="v-desc"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Vehicle Description
              </label>
              <textarea
                id="v-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Describe comfort, ideal Sri Lankan routes, and cabin luxury..."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="v-highlights"
                className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Highlights (one per line)
              </label>
              <textarea
                id="v-highlights"
                rows={3}
                value={form.highlightsText}
                onChange={(e) =>
                  setForm({ ...form, highlightsText: e.target.value })
                }
                placeholder={'English-Speaking Chauffeur\nComplimentary Bottled Water\nAirport Meet & Greet'}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>
          </div>

          {/* Photo Upload & Replacement */}
          <div className="space-y-3 rounded-xl border border-[var(--border-gold)] bg-[var(--bg-card-elevated)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-accent)]">
                  Vehicle Photos
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Uploaded photos are automatically optimized to WebP for fast
                  mobile loading.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-full btn-gold px-3.5 py-2 text-xs cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload Photo(s)'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    disabled={uploading}
                    onChange={(e) => handleFileUpload(e, { replacePrimary: false })}
                    data-testid="vehicle-photo-upload-input"
                    className="sr-only"
                  />
                </label>

                {form.photos.length > 0 ? (
                  <label className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] cursor-pointer">
                    <ImagePlus className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                    <span>Replace Primary</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={uploading}
                      onChange={(e) => handleFileUpload(e, { replacePrimary: true })}
                      className="sr-only"
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {uploadInfo ? (
              <p className="text-xs text-emerald-500 dark:text-emerald-400">
                {uploadInfo}
              </p>
            ) : null}

            {/* Optional direct HTTPS URL input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="Or paste an image URL (https://... or /vehicles/...)"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-8 pr-3 text-xs text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddExternalUrl}
                className="rounded-xl border border-[var(--border-gold)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
              >
                Add URL
              </button>
            </div>

            {form.photos.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No photos attached yet. Vehicles without photos display a clean
                studio placeholder on the storefront.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {form.photos.map((photo, idx) => (
                  <div
                    key={`${photo.url}-${idx}`}
                    className={`overflow-hidden rounded-xl border ${
                      photo.isPrimary
                        ? 'border-[var(--gold-bright)]'
                        : 'border-[var(--border-subtle)]'
                    } bg-[var(--bg-card)]`}
                  >
                    <div className="aspect-[16/10] bg-[#121216]">
                      <VehiclePhoto
                        src={photo.url}
                        alt={photo.alt || form.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1 p-2">
                      <button
                        type="button"
                        onClick={() => setPrimaryPhoto(idx)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                          photo.isPrimary
                            ? 'bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <Star className="h-3 w-3" />
                        <span>{photo.isPrimary ? 'Primary' : 'Make Primary'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        aria-label="Remove photo"
                        className="rounded-md p-1 text-red-500 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border-subtle)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              data-testid="vehicle-form-save"
              className="btn-gold rounded-full px-6 py-2.5 text-sm cursor-pointer"
            >
              {saving
                ? 'Saving...'
                : isEditing
                  ? 'Save Vehicle Changes'
                  : 'Create Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
