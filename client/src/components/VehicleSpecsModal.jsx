import {
  Briefcase,
  CheckCircle2,
  Cog,
  Fuel,
  Send,
  Snowflake,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildVehicleEnquiryMessage } from '../lib/whatsapp';
import { VehiclePhoto } from './VehiclePhoto';
import { WhatsAppButton } from './WhatsAppButton';

export function VehicleSpecsModal({
  vehicle,
  whatsappNumber,
  onClose,
  onSelectForEnquiry,
}) {
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    setPhotoIdx(0);
  }, [vehicle?._id]);

  useEffect(() => {
    if (!vehicle) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [vehicle, onClose]);

  if (!vehicle) return null;

  const photos = vehicle.photos || [];
  const activePhoto = photos[photoIdx] || photos[0] || null;
  const specs = vehicle.specs || {};
  const message = buildVehicleEnquiryMessage(vehicle.name);

  const specRows = [
    specs.seats
      ? { label: 'Seating Capacity', value: `${specs.seats} Passengers`, icon: Users }
      : null,
    specs.transmission
      ? { label: 'Transmission', value: specs.transmission, icon: Cog }
      : null,
    specs.luggage
      ? { label: 'Luggage Capacity', value: specs.luggage, icon: Briefcase }
      : null,
    specs.chauffeur
      ? { label: 'Chauffeur', value: specs.chauffeur, icon: UserCheck }
      : null,
    specs.fuelType
      ? { label: 'Fuel / Powertrain', value: specs.fuelType, icon: Fuel }
      : null,
    specs.airConditioning
      ? { label: 'Climate Control', value: 'Air Conditioned Cabin', icon: Snowflake }
      : null,
  ].filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-specs-title"
      data-testid="vehicle-specs-modal"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[var(--border-gold)] bg-[var(--bg-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {(vehicle.categories || []).map((cat) => (
                <span
                  key={cat._id || cat.slug}
                  className="rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--gold-accent)]"
                >
                  {cat.name}
                </span>
              ))}
              {vehicle.year ? (
                <span className="text-xs text-[var(--text-muted)]">
                  · {vehicle.year}
                </span>
              ) : null}
            </div>
            <h2
              id="vehicle-specs-title"
              translate="no"
              className="notranslate text-xl sm:text-2xl font-semibold text-[var(--text-primary)]"
            >
              {vehicle.name}
            </h2>
            {vehicle.model && vehicle.model !== vehicle.name ? (
              <p
                translate="no"
                className="notranslate text-xs sm:text-sm text-[var(--text-muted)]"
              >
                {vehicle.model}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close specifications"
            data-testid="close-specs-modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable details */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Primary photo + optional gallery thumbnails */}
          <div className="space-y-2.5">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#121216]">
              <VehiclePhoto
                src={activePhoto?.url}
                alt={activePhoto?.alt || vehicle.name}
                eager
                className="h-full w-full object-cover"
              />
            </div>

            {photos.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {photos.map((photo, idx) => (
                  <button
                    key={photo._id || photo.url || idx}
                    type="button"
                    onClick={() => setPhotoIdx(idx)}
                    aria-label={`View photo ${idx + 1} of ${vehicle.name}`}
                    className={`h-14 w-22 shrink-0 overflow-hidden rounded-lg border transition-all cursor-pointer ${
                      idx === photoIdx
                        ? 'border-[var(--gold-bright)] ring-2 ring-[var(--gold-bright)]/40'
                        : 'border-[var(--border-subtle)] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <VehiclePhoto
                      src={photo.url}
                      alt={photo.alt || `${vehicle.name} photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Description */}
          {vehicle.description || vehicle.summary ? (
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {vehicle.description || vehicle.summary}
            </p>
          ) : null}

          {/* Structured specifications grid */}
          {specRows.length > 0 ? (
            <div>
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-accent)]">
                Key Specifications
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {specRows.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-3"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <Icon
                        className="h-3.5 w-3.5 text-[var(--gold-accent)]"
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Highlights */}
          {vehicle.highlights?.length > 0 ? (
            <div>
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-accent)]">
                Included Highlights
              </h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {vehicle.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-accent)]"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
            Availability, tailored rates, and booking confirmation are handled
            directly with our Colombo Tours concierge via WhatsApp.
          </p>
        </div>

        {/* Sticky modal footer */}
        <div className="flex flex-col-reverse gap-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center">
          {onSelectForEnquiry ? (
            <button
              type="button"
              onClick={() => {
                onSelectForEnquiry(vehicle);
                onClose?.();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
            >
              <Send className="h-4 w-4 text-[var(--gold-accent)]" />
              <span>Add Dates in Quick Enquiry</span>
            </button>
          ) : null}

          <WhatsAppButton
            whatsappNumber={whatsappNumber}
            message={message}
            variant="gold"
            size="md"
            dataTestId="modal-whatsapp-btn"
            className="flex-1 py-2.5"
          >
            Book via WhatsApp
          </WhatsAppButton>
        </div>
      </div>
    </div>
  );
}
