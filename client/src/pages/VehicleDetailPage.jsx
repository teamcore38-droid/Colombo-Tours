import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cog,
  Fuel,
  MapPin,
  Share2,
  Snowflake,
  UserCheck,
  Users,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookingChannelGroup } from '../components/ChannelButtons';
import { FloatingContactButtons } from '../components/FloatingContactButtons';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { VehiclePhoto } from '../components/VehiclePhoto';
import { WeChatEnquiryModal } from '../components/WeChatEnquiryModal';
import { useSite } from '../context/SiteContext';
import {
  buildVehicleEnquiryMessage,
  buildVehicleShareUrl,
  sanitizeVehicleSlug,
  validateRentalDates,
} from '../lib/channels';

function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function copyTextSafe(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function VehicleDetailPage() {
  const { slug: rawSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, vehicles, loading, error, refreshSiteData } = useSite();

  const safeSlug = sanitizeVehicleSlug(rawSlug || '');
  const vehicle = useMemo(
    () => (safeSlug ? vehicles.find((v) => v.slug === safeSlug) || null : null),
    [safeSlug, vehicles]
  );

  const [photoIdx, setPhotoIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [chauffeurPreferred, setChauffeurPreferred] = useState(true);

  const todayIso = useMemo(() => getTodayIso(), []);
  const dateError = useMemo(
    () => validateRentalDates(pickupDate, returnDate, todayIso),
    [pickupDate, returnDate, todayIso]
  );

  // Reset scroll to top synchronously before first paint so CSS scroll-behavior: smooth never animates upward
  useLayoutEffect(() => {
    const root = document.documentElement;
    const prevScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      // Fallback for older browsers or test environments
    }
    root.scrollTop = 0;
    if (document.body) {
      document.body.scrollTop = 0;
    }
    root.style.scrollBehavior = prevScrollBehavior;
  }, [safeSlug]);

  useEffect(() => {
    setPhotoIdx(0);
    setCopiedLink(false);
  }, [safeSlug]);

  useEffect(() => {
    if (!vehicle) return undefined;
    const prevTitle = document.title;
    document.title = `${vehicle.name} — ${settings.companyName || 'Colombo Tours'}`;
    return () => {
      document.title = prevTitle;
    };
  }, [vehicle, settings.companyName]);

  const relatedVehicles = useMemo(() => {
    if (!vehicle || vehicles.length <= 1) return [];
    const currentCatSlugs = new Set(
      (vehicle.categories || []).map((c) => c.slug)
    );
    const others = vehicles.filter((v) => v.slug !== vehicle.slug);
    const scored = others
      .map((item) => {
        const shared = (item.categories || []).filter((c) =>
          currentCatSlugs.has(c.slug)
        ).length;
        return { item, score: shared * 2 + (item.isFeatured ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => s.item);
  }, [vehicle, vehicles]);

  const handleBack = () => {
    if (location.state?.fromFleet) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const shareUrl = vehicle ? buildVehicleShareUrl(vehicle.slug) : '';

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    const ok = await copyTextSafe(shareUrl);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2400);
    }
  };

  const photos = vehicle?.photos || [];
  const activePhoto = photos[photoIdx] || photos[0] || null;
  const specs = vehicle?.specs || {};

  const hasTripCustomizations =
    Boolean(pickupLocation.trim()) ||
    Boolean(pickupDate.trim()) ||
    Boolean(returnDate.trim()) ||
    showTripDetails;

  const enquiryMessage = vehicle
    ? buildVehicleEnquiryMessage(vehicle, {
        pickupLocation: hasTripCustomizations ? pickupLocation : '',
        pickupDate: hasTripCustomizations ? pickupDate : '',
        returnDate: hasTripCustomizations ? returnDate : '',
        chauffeurPreferred: hasTripCustomizations ? chauffeurPreferred : false,
      })
    : settings.supportGreeting;

  const specRows = vehicle
    ? [
        specs.seats
          ? {
              label: 'Seating Capacity',
              value: `${specs.seats} Passengers`,
              icon: Users,
            }
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
          ? {
              label: 'Climate Control',
              value: 'Air Conditioned Cabin',
              icon: Snowflake,
            }
          : null,
      ].filter(Boolean)
    : [];

  return (
    <div
      data-testid="vehicle-detail-page"
      className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]"
    >
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 pt-4 pb-8 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7">
        {/* Top Back Navigation & Share Bar */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            data-testid="vehicle-back-btn"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-4 py-2 text-xs sm:text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--gold-accent)]" />
            <span>Back to Fleet</span>
          </button>

          {vehicle && shareUrl ? (
            <button
              type="button"
              onClick={handleCopyShareLink}
              data-testid="vehicle-copy-link-btn"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-gold)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                  <span>Share Link</span>
                </>
              )}
            </button>
          ) : null}
        </div>

        {/* Error banner */}
        {error ? (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refreshSiteData()}
              className="rounded-full border border-current px-3 py-1 text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Loading skeleton */}
        {loading && !vehicle ? (
          <div
            aria-label="Loading vehicle details"
            className="grid grid-cols-1 gap-6 lg:grid-cols-12 animate-pulse"
          >
            <div className="lg:col-span-7 space-y-4">
              <div className="aspect-[16/10] w-full rounded-2xl bg-[var(--bg-input)]" />
              <div className="h-6 w-2/3 rounded bg-[var(--bg-input)]" />
              <div className="h-20 w-full rounded-xl bg-[var(--bg-input)]" />
            </div>
            <div className="lg:col-span-5">
              <div className="h-72 w-full rounded-2xl bg-[var(--bg-input)]" />
            </div>
          </div>
        ) : !vehicle ? (
          /* Clean Vehicle Not Found state */
          <section
            data-testid="vehicle-not-found"
            className="card-luxury mx-auto max-w-lg rounded-2xl px-6 py-12 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]">
              <CarFront className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">
              Vehicle Not Found
            </h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This vehicle may no longer be available or the link may be
              incorrect. Browse our full Sri Lankan luxury fleet instead.
            </p>
            <div className="mt-6">
              <Link
                to="/"
                className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Browse Full Fleet</span>
              </Link>
            </div>
          </section>
        ) : (
          /* Full-page responsive vehicle showcase */
          <div className="space-y-10 sm:space-y-12">
            {/* Subtle banner if no channel configured yet */}
            {!settings.whatsappConfigured &&
            !settings.telegramConfigured &&
            !settings.wechatConfigured ? (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-secondary)]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-[var(--gold-accent)]" />
                <span>
                  Booking buttons (WhatsApp, Telegram, WeChat) are currently
                  disabled until at least one contact channel is saved in the
                  Staff Admin Dashboard.
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
              {/* Left Column: Title (mobile), Photo Gallery, Description, Specs & Highlights */}
              <div className="lg:col-span-7 space-y-6">
                {/* Vehicle Header (shown above photo on mobile & desktop) */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {(vehicle.categories || []).map((cat) => (
                      <span
                        key={cat._id || cat.slug}
                        className="rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--gold-accent)]"
                      >
                        {cat.name}
                      </span>
                    ))}
                    {vehicle.year ? (
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        · {vehicle.year}
                      </span>
                    ) : null}
                  </div>
                  <h1
                    data-testid="vehicle-detail-title"
                    translate="no"
                    className="notranslate text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[var(--text-primary)]"
                  >
                    {vehicle.name}
                  </h1>
                  {vehicle.model && vehicle.model !== vehicle.name ? (
                    <p
                      translate="no"
                      className="notranslate mt-1 text-sm sm:text-base text-[var(--text-muted)]"
                    >
                      {vehicle.model}
                    </p>
                  ) : null}
                </div>

                {/* Primary Photo + Gallery Thumbnails */}
                <div className="space-y-3">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--border-gold)] bg-[#121216] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)]">
                    <VehiclePhoto
                      src={activePhoto?.url}
                      alt={activePhoto?.alt || vehicle.name}
                      eager
                      deliveryWidth={1280}
                      className="h-full w-full object-cover object-center"
                    />
                    {vehicle.isFeatured ? (
                      <span className="absolute left-3.5 top-3.5 rounded-full border border-[#D4AF37]/45 bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E8CB7D] backdrop-blur-xs">
                        Featured
                      </span>
                    ) : null}
                  </div>

                  {photos.length > 1 ? (
                    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                      {photos.map((photo, idx) => (
                        <button
                          key={photo._id || photo.url || idx}
                          type="button"
                          onClick={() => setPhotoIdx(idx)}
                          aria-label={`View photo ${idx + 1} of ${vehicle.name}`}
                          className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition-all cursor-pointer ${
                            idx === photoIdx
                              ? 'border-[var(--gold-bright)] ring-2 ring-[var(--gold-bright)]/40'
                              : 'border-[var(--border-subtle)] opacity-75 hover:opacity-100'
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

                {/* Mobile Booking Card (right below photo so users can book immediately without scrolling past specs) */}
                <div className="lg:hidden">
                  <VehicleBookingCard
                    vehicle={vehicle}
                    whatsappNumber={settings.whatsappNumber}
                    enquiryMessage={enquiryMessage}
                    showTripDetails={showTripDetails}
                    setShowTripDetails={setShowTripDetails}
                    pickupLocation={pickupLocation}
                    setPickupLocation={setPickupLocation}
                    pickupDate={pickupDate}
                    setPickupDate={setPickupDate}
                    returnDate={returnDate}
                    setReturnDate={setReturnDate}
                    chauffeurPreferred={chauffeurPreferred}
                    setChauffeurPreferred={setChauffeurPreferred}
                    todayIso={todayIso}
                    dateError={dateError}
                    testIdPrefix="detail-mobile"
                  />
                </div>

                {/* Description */}
                {vehicle.description || vehicle.summary ? (
                  <section aria-labelledby="vehicle-overview-heading">
                    <h2
                      id="vehicle-overview-heading"
                      className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-accent)]"
                    >
                      Overview
                    </h2>
                    <p className="text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
                      {vehicle.description || vehicle.summary}
                    </p>
                  </section>
                ) : null}

                {/* Structured Key Specifications Grid */}
                {specRows.length > 0 ? (
                  <section aria-labelledby="vehicle-specs-heading">
                    <h2
                      id="vehicle-specs-heading"
                      className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-accent)]"
                    >
                      Key Specifications
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {specRows.map(({ label, value, icon: Icon }) => (
                        <div
                          key={label}
                          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-3.5"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <Icon
                              className="h-3.5 w-3.5 shrink-0 text-[var(--gold-accent)]"
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* Included Highlights */}
                {vehicle.highlights?.length > 0 ? (
                  <section aria-labelledby="vehicle-highlights-heading">
                    <h2
                      id="vehicle-highlights-heading"
                      className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-accent)]"
                    >
                      Included Highlights
                    </h2>
                    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {vehicle.highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]"
                        >
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-accent)]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>

              {/* Right Sticky Booking Column (Desktop lg+) */}
              <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-24">
                <VehicleBookingCard
                  vehicle={vehicle}
                  whatsappNumber={settings.whatsappNumber}
                  enquiryMessage={enquiryMessage}
                  showTripDetails={showTripDetails}
                  setShowTripDetails={setShowTripDetails}
                  pickupLocation={pickupLocation}
                  setPickupLocation={setPickupLocation}
                  pickupDate={pickupDate}
                  setPickupDate={setPickupDate}
                  returnDate={returnDate}
                  setReturnDate={setReturnDate}
                  chauffeurPreferred={chauffeurPreferred}
                  setChauffeurPreferred={setChauffeurPreferred}
                  todayIso={todayIso}
                  dateError={dateError}
                  testIdPrefix="detail"
                />
              </aside>
            </div>

            {/* Related Luxury Vehicles */}
            {relatedVehicles.length > 0 ? (
              <section
                aria-labelledby="related-fleet-heading"
                className="border-t border-[var(--border-subtle)] pt-8"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2
                    id="related-fleet-heading"
                    className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]"
                  >
                    More Vehicles You May Like
                  </h2>
                  <Link
                    to="/"
                    className="text-xs sm:text-sm font-medium text-[var(--gold-accent)] hover:underline"
                  >
                    View all fleet →
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedVehicles.map((item) => {
                    const photo =
                      item.photos?.find((p) => p.isPrimary) ||
                      item.photos?.[0] ||
                      null;
                    return (
                      <Link
                        key={item._id || item.slug}
                        to={`/vehicle/${item.slug}`}
                        state={{ fromFleet: true }}
                        className="card-luxury group flex flex-col overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5"
                      >
                        <div className="aspect-[16/10] w-full overflow-hidden bg-[#121216]">
                          <VehiclePhoto
                            src={photo?.url}
                            alt={photo?.alt || item.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="p-3.5">
                          <h3
                            translate="no"
                            className="notranslate text-sm sm:text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--gold-accent)] transition-colors"
                          >
                            {item.name}
                          </h3>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {[
                              item.specs?.seats
                                ? `${item.specs.seats} Seats`
                                : '',
                              item.specs?.transmission || '',
                              item.specs?.chauffeur || '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>

      <Footer />
      <FloatingContactButtons />
      <WeChatEnquiryModal />
    </div>
  );
}

function VehicleBookingCard({
  vehicle,
  whatsappNumber,
  enquiryMessage,
  showTripDetails,
  setShowTripDetails,
  pickupLocation,
  setPickupLocation,
  pickupDate,
  setPickupDate,
  returnDate,
  setReturnDate,
  chauffeurPreferred,
  setChauffeurPreferred,
  todayIso,
  dateError,
  testIdPrefix,
}) {
  return (
    <div className="card-luxury rounded-2xl p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
          Book{' '}
          <span translate="no" className="notranslate">
            {vehicle.name}
          </span>
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
          Choose WhatsApp, Telegram, or WeChat — this vehicle&apos;s details and
          link are automatically included in your message.
        </p>
      </div>

      {/* 3-channel instant booking buttons */}
      <BookingChannelGroup
        message={enquiryMessage}
        subjectLabel={vehicle.name}
        whatsappNumber={whatsappNumber}
        preferWeChatModal
        disabled={Boolean(dateError)}
        size="sm"
        whatsappTestId={`${testIdPrefix}-whatsapp-btn`}
        telegramTestId={`${testIdPrefix}-telegram-btn`}
        wechatTestId={`${testIdPrefix}-wechat-btn`}
      />

      {/* Optional collapsible trip details (pickup location & dates) */}
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <button
          type="button"
          onClick={() => setShowTripDetails((prev) => !prev)}
          aria-expanded={showTripDetails}
          data-testid={`${testIdPrefix}-toggle-dates-btn`}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border-gold)] bg-[var(--bg-pill)] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--gold-accent)]" />
            <span>Add Pickup Location &amp; Dates (Optional)</span>
          </span>
          {showTripDetails ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          )}
        </button>

        {showTripDetails ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`${testIdPrefix}-pickup-location`}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
              >
                <MapPin className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                <span>Pickup Location</span>
              </label>
              <input
                id={`${testIdPrefix}-pickup-location`}
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g., Airport (CMB), Colombo, Kandy..."
                maxLength={120}
                data-testid={`${testIdPrefix}-pickup-location`}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor={`${testIdPrefix}-pickup-date`}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  <Calendar className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                  <span>Pickup Date</span>
                </label>
                <input
                  id={`${testIdPrefix}-pickup-date`}
                  type="date"
                  min={todayIso}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  data-testid={`${testIdPrefix}-pickup-date`}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={`${testIdPrefix}-return-date`}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  <Calendar className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                  <span>Return Date</span>
                </label>
                <input
                  id={`${testIdPrefix}-return-date`}
                  type="date"
                  min={pickupDate || todayIso}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  data-testid={`${testIdPrefix}-return-date`}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-xs sm:text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={chauffeurPreferred}
                onChange={(e) => setChauffeurPreferred(e.target.checked)}
                className="h-4 w-4 rounded accent-[#D4AF37]"
              />
              <span>Include professional English-speaking chauffeur</span>
            </label>

            {dateError ? (
              <p
                role="alert"
                data-testid={`${testIdPrefix}-date-error`}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-500 dark:text-red-300"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{dateError}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
        Availability, tailored rates, and booking confirmation are handled
        directly with our Colombo Tours concierge.
      </p>
    </div>
  );
}
