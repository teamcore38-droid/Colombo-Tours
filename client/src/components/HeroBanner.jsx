import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildVehicleEnquiryMessage } from '../lib/channels';
import { BookingChannelGroup } from './ChannelButtons';
import { VehiclePhoto } from './VehiclePhoto';

function pickHeroPhoto(vehicle, preferHeroWide = false) {
  const photos = vehicle?.photos || [];
  if (preferHeroWide) {
    const heroPhoto = photos.find((p) => p.url?.includes('-hero.'));
    if (heroPhoto) return heroPhoto;
  }
  return photos.find((p) => p.isPrimary) || photos[0] || null;
}

export function HeroBanner({
  featuredVehicles = [],
  settings,
  loading = false,
  onViewSpecs,
  autoPlayMs = 4500,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);

  const slideCount = featuredVehicles.length;
  const safeIndex = slideCount > 0 ? activeIndex % slideCount : 0;
  const activeVehicle = featuredVehicles[safeIndex] || null;

  const enquiryMessage = activeVehicle
    ? buildVehicleEnquiryMessage(activeVehicle.name)
    : settings.supportGreeting;

  const handlePrev = useCallback(() => {
    if (slideCount <= 1) return;
    setActiveIndex((prev) => (prev - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const handleNext = useCallback(() => {
    if (slideCount <= 1) return;
    setActiveIndex((prev) => (prev + 1) % slideCount);
  }, [slideCount]);

  // Smooth auto-carousel across featured vehicles (respects hover/focus/reduced motion)
  useEffect(() => {
    if (slideCount <= 1 || paused || autoPlayMs <= 0) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [slideCount, paused, autoPlayMs]);

  const handleTouchStart = (e) => {
    setPaused(true);
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    const startX = touchStartX.current;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    touchStartX.current = null;
    if (startX !== null && endX !== null) {
      const delta = startX - endX;
      if (Math.abs(delta) >= 40) {
        if (delta > 0) handleNext();
        else handlePrev();
      }
    }
    setPaused(false);
  };

  return (
    <section
      aria-label="Featured Sri Lanka Luxury Fleet"
      data-testid="hero-banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="mb-5 sm:mb-7 lg:mb-8"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-gold)] bg-[#0E0E12] text-[#F6F3EC] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)]">
        {/* Warm champagne ambient lighting & subtle ornamental Sri Lankan filigree */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(62% 95% at 74% 40%, rgba(212, 175, 55, 0.20) 0%, rgba(155, 118, 38, 0.06) 44%, rgba(10, 10, 13, 0) 76%)',
          }}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 320 320"
          className="pointer-events-none absolute -right-12 top-6 h-[220px] w-[220px] sm:h-[280px] sm:w-[280px] lg:-right-10 lg:top-1/2 lg:h-[360px] lg:w-[360px] lg:-translate-y-1/2 opacity-[0.11] text-[#D4AF37]"
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

        <div className="relative grid grid-cols-1 items-center lg:grid-cols-12 lg:min-h-[310px] xl:min-h-[340px]">
          {/* Auto-carousel vehicle stage: top on mobile/tablet, right column on desktop */}
          <div className="relative order-1 lg:order-2 lg:col-span-6 lg:h-full flex items-center justify-end lg:pr-4 lg:py-3">
            <div className="relative w-full aspect-[16/9] max-h-[210px] sm:max-h-[260px] lg:max-h-[305px] overflow-hidden lg:rounded-xl">
              {slideCount > 0 ? (
                featuredVehicles.map((vehicle, idx) => {
                  const isActive = idx === safeIndex;
                  const photo = pickHeroPhoto(vehicle, false);
                  return (
                    <div
                      key={vehicle._id || vehicle.slug || idx}
                      aria-hidden={!isActive}
                      className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                        isActive
                          ? 'opacity-100 z-10'
                          : 'opacity-0 z-0 pointer-events-none'
                      }`}
                    >
                      <VehiclePhoto
                        src={photo?.url}
                        alt={photo?.alt || vehicle.name}
                        eager={idx === 0}
                        deliveryWidth={1280}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                  );
                })
              ) : loading ? (
                <div
                  aria-hidden="true"
                  className="h-full w-full animate-pulse bg-gradient-to-br from-[#191920] via-[#121217] to-[#0E0E12]"
                />
              ) : (
                <VehiclePhoto
                  src=""
                  alt="Colombo Tours Featured Vehicle"
                  eager
                  className="h-full w-full object-cover object-center"
                />
              )}

              {/* Seamless dark studio fade: bottom on mobile/tablet, left edge on desktop */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/60 to-transparent lg:hidden"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none hidden lg:block absolute inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-[#0E0E12] via-[#0E0E12]/55 to-transparent"
              />
            </div>

            {activeVehicle ? (
              <div
                data-testid="hero-active-vehicle-badge"
                className="absolute bottom-3 right-3 lg:bottom-5 lg:right-7 z-30 rounded-full border border-[#D4AF37]/35 bg-black/70 px-3 py-1 text-[11px] sm:text-xs font-medium text-[#EFE6CE] backdrop-blur-xs"
              >
                Featured:{' '}
                <span translate="no" className="notranslate">
                  {activeVehicle.name}
                </span>
              </div>
            ) : null}
          </div>

          {/* Typography & CTA: compact underneath on mobile/tablet, left column on desktop */}
          <div className="order-2 lg:order-1 lg:col-span-6 z-10 px-4 pt-2 pb-4 sm:px-7 sm:pt-3 sm:pb-5 lg:px-9 lg:py-9 xl:px-11">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.15em] text-[#E6C875] mb-2.5 sm:mb-3.5">
              <Sparkles className="h-3 w-3" />
              <span>
                <span translate="no" className="notranslate">
                  {settings.companyName}
                </span>{' '}
                · Sri Lanka
              </span>
            </div>

            <h1 className="font-display text-[1.65rem] sm:text-3xl lg:text-4xl xl:text-[2.95rem] font-semibold uppercase leading-[1.08] tracking-[0.02em] text-[#F1D896]">
              {settings.heroHeadline}
            </h1>

            <p className="mt-2 sm:mt-3 max-w-md text-xs sm:text-sm xl:text-[0.95rem] leading-relaxed text-[#C7C1B5]">
              {settings.heroSubheadline}
            </p>

            <div className="mt-4 sm:mt-5 lg:mt-6 space-y-2.5">
              <BookingChannelGroup
                message={enquiryMessage}
                subjectLabel={activeVehicle?.name || 'Featured Vehicle Enquiry'}
                whatsappNumber={settings.whatsappNumber}
                whatsappLink={settings.whatsappLink}
                whatsappMode={settings.whatsappMode}
                whatsappEnabled={settings.whatsappEnabled}
                telegramHandle={settings.telegramHandle}
                telegramLink={settings.telegramLink}
                telegramMode={settings.telegramMode}
                telegramEnabled={settings.telegramEnabled}
                wechatId={settings.wechatId}
                wechatLink={settings.wechatLink}
                wechatQrUrl={settings.wechatQrUrl}
                wechatMode={settings.wechatMode}
                wechatEnabled={settings.wechatEnabled}
                size="sm"
                layout="row"
                whatsappTestId="hero-whatsapp-btn"
                telegramTestId="hero-telegram-btn"
                wechatTestId="hero-wechat-btn"
              />

              {activeVehicle ? (
                <div>
                  <button
                    type="button"
                    onClick={() => onViewSpecs?.(activeVehicle)}
                    data-testid="hero-view-specs-btn"
                    className="rounded-full border border-[#D4AF37]/35 bg-white/5 px-4 py-2 text-xs sm:text-sm font-medium text-[#F6F3EC] hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/10 transition-colors cursor-pointer"
                  >
                    <span className="sm:hidden">View Specs</span>
                    <span className="hidden sm:inline">
                      View{' '}
                      <span translate="no" className="notranslate">
                        {activeVehicle.name}
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Carousel controls & pagination dots (visible on mobile, tablet & desktop) */}
        {slideCount > 1 ? (
          <div className="relative z-10 flex items-center justify-center gap-3 pb-3.5 sm:pb-4">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous featured vehicle"
              data-testid="hero-prev-btn"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#C7C1B5] hover:border-[#D4AF37]/50 hover:text-[#E6C875] cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Featured vehicles"
            >
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
              data-testid="hero-next-btn"
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
