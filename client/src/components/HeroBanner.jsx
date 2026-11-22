import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { buildVehicleEnquiryMessage } from '../lib/whatsapp';
import { VehiclePhoto } from './VehiclePhoto';
import { WhatsAppButton } from './WhatsAppButton';

export function HeroBanner({
  featuredVehicles = [],
  settings,
  onViewSpecs,
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const safeIndex =
    featuredVehicles.length > 0 ? activeIndex % featuredVehicles.length : 0;
  const activeVehicle = featuredVehicles[safeIndex] || null;
  const primaryPhoto =
    activeVehicle?.photos?.find((p) => p.url?.includes('-hero.')) ||
    activeVehicle?.photos?.find((p) => p.isPrimary) ||
    activeVehicle?.photos?.[0] ||
    null;

  const enquiryMessage = activeVehicle
    ? buildVehicleEnquiryMessage(activeVehicle.name)
    : settings.supportGreeting;

  const handlePrev = () => {
    if (featuredVehicles.length <= 1) return;
    setActiveIndex(
      (prev) => (prev - 1 + featuredVehicles.length) % featuredVehicles.length
    );
  };

  const handleNext = () => {
    if (featuredVehicles.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % featuredVehicles.length);
  };

  return (
    <section
      aria-label="Featured Sri Lanka Luxury Fleet"
      className="hidden lg:block mb-8"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-gold)] bg-[#0E0E12] text-[#F6F3EC] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)]">
        {/* Warm champagne ambient lighting & subtle ornamental Sri Lankan filigree */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(62% 95% at 74% 48%, rgba(212, 175, 55, 0.20) 0%, rgba(155, 118, 38, 0.06) 44%, rgba(10, 10, 13, 0) 76%)',
          }}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 320 320"
          className="pointer-events-none absolute -right-10 top-1/2 h-[360px] w-[360px] -translate-y-1/2 opacity-[0.11] text-[#D4AF37]"
          fill="none"
        >
          <circle cx="160" cy="160" r="144" stroke="currentColor" strokeWidth="1" />
          <circle cx="160" cy="160" r="118" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 6" />
          <circle cx="160" cy="160" r="90" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="160" cy="160" r="56" stroke="currentColor" strokeWidth="0.75" />
          <path
            d="M160 16L176 74L232 48L204 102L268 108L216 144L276 176L212 184L246 240L188 214L192 276L160 226L128 276L132 214L74 240L108 184L44 176L104 144L52 108L116 102L88 48L144 74L160 16Z"
            stroke="currentColor"
            strokeWidth="0.75"
          />
        </svg>

        <div className="relative grid grid-cols-12 items-center min-h-[310px] xl:min-h-[340px]">
          {/* Left typography & CTA */}
          <div className="col-span-6 z-10 px-9 py-9 xl:px-11">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E6C875] mb-4">
              <Sparkles className="h-3 w-3" />
              <span>{settings.companyName} · Sri Lanka</span>
            </div>

            <h1 className="font-display text-4xl xl:text-[2.95rem] font-semibold uppercase leading-[1.06] tracking-[0.02em] text-[#F1D896]">
              {settings.heroHeadline}
            </h1>

            <p className="mt-3.5 max-w-md text-sm xl:text-[0.95rem] leading-relaxed text-[#C7C1B5]">
              {settings.heroSubheadline}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <WhatsAppButton
                whatsappNumber={settings.whatsappNumber}
                message={enquiryMessage}
                variant="gold"
                size="lg"
                dataTestId="hero-whatsapp-btn"
              >
                Book on WhatsApp
              </WhatsAppButton>

              {activeVehicle ? (
                <button
                  type="button"
                  onClick={() => onViewSpecs?.(activeVehicle)}
                  className="rounded-full border border-[#D4AF37]/35 bg-white/5 px-5 py-3 text-sm font-medium text-[#F6F3EC] hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/10 transition-colors cursor-pointer"
                >
                  View {activeVehicle.name}
                </button>
              ) : null}
            </div>
          </div>

          {/* Right featured vehicle studio photo */}
          <div className="col-span-6 relative h-full flex items-center justify-end pr-4 py-3">
            <div
              className="relative w-full aspect-[16/9] max-h-[305px] overflow-hidden rounded-xl"
              style={{
                maskImage:
                  'linear-gradient(to right, transparent 0%, black 18%, black 96%, transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to right, transparent 0%, black 18%, black 96%, transparent 100%)',
              }}
            >
              <VehiclePhoto
                src={primaryPhoto?.url}
                alt={primaryPhoto?.alt || activeVehicle?.name || 'Colombo Tours Featured Vehicle'}
                eager
                className="h-full w-full object-cover object-center"
              />
            </div>
            {activeVehicle ? (
              <div className="absolute bottom-5 right-7 rounded-full border border-[#D4AF37]/30 bg-black/65 px-3 py-1 text-xs font-medium text-[#EFE6CE] backdrop-blur-xs">
                Featured: {activeVehicle.name}
              </div>
            ) : null}
          </div>
        </div>

        {/* Hero carousel controls matching reference bottom dots */}
        {featuredVehicles.length > 1 ? (
          <div className="relative z-10 flex items-center justify-center gap-3 pb-4">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous featured vehicle"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#C7C1B5] hover:border-[#D4AF37]/50 hover:text-[#E6C875] cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-2" role="tablist" aria-label="Featured vehicles">
              {featuredVehicles.map((v, idx) => (
                <button
                  key={v._id || v.slug || idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === safeIndex}
                  aria-label={`Show ${v.name}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === safeIndex
                      ? 'w-5 bg-[#E1C06F]'
                      : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next featured vehicle"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#C7C1B5] hover:border-[#D4AF37]/50 hover:text-[#E6C875] cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
