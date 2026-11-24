import {
  Briefcase,
  Cog,
  Crown,
  Send,
  UserCheck,
  Users,
} from 'lucide-react';
import { buildVehicleEnquiryMessage } from '../lib/channels';
import { BookingChannelGroup } from './ChannelButtons';
import { VehiclePhoto } from './VehiclePhoto';

export function VehicleCard({
  vehicle,
  whatsappNumber,
  eager = false,
  onViewSpecs,
  onSelectForEnquiry,
}) {
  const primaryPhoto =
    vehicle.photos?.find((p) => p.isPrimary) || vehicle.photos?.[0] || null;
  const specs = vehicle.specs || {};
  const primaryCategory =
    vehicle.categories?.find(
      (c) => c.slug !== 'chauffeur' && c.slug !== 'airport-transfer'
    )?.name ||
    vehicle.categories?.find((c) => c.slug !== 'chauffeur')?.name ||
    vehicle.categories?.[0]?.name ||
    '';
  const message = buildVehicleEnquiryMessage(vehicle);

  const chauffeurLabel = specs.chauffeur
    ? specs.chauffeur.toLowerCase().includes('chauffeur')
      ? 'Chauffeur'
      : specs.chauffeur
    : '';

  const specPills = [
    specs.transmission
      ? { key: 'transmission', label: specs.transmission, icon: Cog }
      : null,
    specs.seats
      ? { key: 'seats', label: `${specs.seats} seats`, icon: Users }
      : null,
    specs.luggage
      ? { key: 'luggage', label: specs.luggage, icon: Briefcase }
      : null,
    primaryCategory
      ? { key: 'category', label: primaryCategory, icon: Crown }
      : null,
    chauffeurLabel &&
    chauffeurLabel.toLowerCase() !== primaryCategory.toLowerCase()
      ? {
          key: 'chauffeur',
          label: chauffeurLabel,
          icon: UserCheck,
        }
      : null,
  ].filter(Boolean);

  return (
    <article
      data-testid={`vehicle-card-${vehicle.slug}`}
      className="card-luxury group flex flex-col overflow-hidden rounded-2xl"
    >
      {/* Vehicle studio photo stage */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#121216]">
        <VehiclePhoto
          src={primaryPhoto?.url}
          alt={primaryPhoto?.alt || vehicle.name}
          eager={eager}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
        />

        {vehicle.isFeatured ? (
          <span className="absolute left-3 top-3 rounded-full border border-[#D4AF37]/45 bg-black/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E8CB7D] backdrop-blur-xs">
            Featured
          </span>
        ) : null}

        {onSelectForEnquiry ? (
          <button
            type="button"
            onClick={() => onSelectForEnquiry(vehicle)}
            title={`Select ${vehicle.name} in Quick Enquiry`}
            aria-label={`Select ${vehicle.name} in Quick Enquiry`}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[#E5DFD2] backdrop-blur-xs transition-colors hover:border-[#D4AF37]/60 hover:text-[#E8CB7D] cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4 sm:p-4.5">
        <div className="mb-3">
          <h3
            translate="no"
            className="notranslate text-[1.05rem] sm:text-lg font-semibold leading-snug text-[var(--text-primary)]"
          >
            {vehicle.name}
          </h3>
          {vehicle.model && vehicle.model !== vehicle.name ? (
            <p
              translate="no"
              className="notranslate mt-0.5 text-xs text-[var(--text-muted)] line-clamp-1"
            >
              {vehicle.model}
            </p>
          ) : null}
        </div>

        {/* Compact spec pills matching reference */}
        {specPills.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {specPills.map(({ key, label, icon: Icon }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
              >
                <Icon
                  className="h-3 w-3 shrink-0 text-[var(--gold-accent)]"
                  aria-hidden="true"
                />
                <span>{label}</span>
              </span>
            ))}
          </div>
        ) : null}

        {/* 3-channel booking options (WhatsApp, Telegram, WeChat) + View Specs */}
        <div className="mt-auto space-y-2 pt-1">
          <BookingChannelGroup
            message={message}
            subjectLabel={vehicle.name}
            whatsappNumber={whatsappNumber}
            preferWeChatModal
            size="xs"
            whatsappTestId={`vehicle-whatsapp-${vehicle.slug}`}
            telegramTestId={`vehicle-telegram-${vehicle.slug}`}
            wechatTestId={`vehicle-wechat-${vehicle.slug}`}
          />

          <button
            type="button"
            onClick={() => onViewSpecs?.(vehicle)}
            data-testid={`vehicle-specs-${vehicle.slug}`}
            className="w-full rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-4 py-2 text-xs sm:text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
          >
            View Specs
          </button>
        </div>
      </div>
    </article>
  );
}
