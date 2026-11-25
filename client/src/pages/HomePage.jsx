import { AlertCircle, CarFront, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CategoryPills } from '../components/CategoryPills';
import { BookingChannelGroup } from '../components/ChannelButtons';
import { FloatingContactButtons } from '../components/FloatingContactButtons';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { QuickEnquiryPanel } from '../components/QuickEnquiryPanel';
import { SearchFilterBar } from '../components/SearchFilterBar';
import { ServicesSection } from '../components/ServicesSection';
import { VehicleCard } from '../components/VehicleCard';
import { WeChatEnquiryModal } from '../components/WeChatEnquiryModal';
import { useSite } from '../context/SiteContext';
import { sanitizeVehicleSlug } from '../lib/channels';

const INITIAL_FILTERS = {
  transmission: 'all',
  chauffeur: 'all',
  minSeats: '',
};

export function HomePage() {
  const { settings, categories, services, vehicles, loading, error, refreshSiteData } =
    useSite();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [enquiryVehicleName, setEnquiryVehicleName] = useState('');

  // Backward-compatible redirect: legacy /?vehicle=<slug> links open the dedicated vehicle page
  const requestedVehicleSlug = sanitizeVehicleSlug(
    searchParams.get('vehicle') || ''
  );

  useEffect(() => {
    if (!requestedVehicleSlug) return;
    navigate(`/vehicle/${encodeURIComponent(requestedVehicleSlug)}`, {
      replace: true,
    });
  }, [requestedVehicleSlug, navigate]);

  // Smooth-scroll to hash section when returning from a vehicle detail page (e.g., /#services)
  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.slice(1);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const featuredVehicles = useMemo(() => {
    const featured = vehicles.filter((v) => v.isFeatured);
    return featured.length > 0 ? featured : vehicles.slice(0, 3);
  }, [vehicles]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.transmission !== 'all') count += 1;
    if (filters.chauffeur !== 'all') count += 1;
    if (filters.minSeats) count += 1;
    return count;
  }, [filters]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minSeatsNum = filters.minSeats ? Number(filters.minSeats) : 0;

    return vehicles.filter((vehicle) => {
      if (activeCategory !== 'all') {
        const hasCategory = (vehicle.categories || []).some(
          (cat) => cat.slug === activeCategory
        );
        if (!hasCategory) return false;
      }

      if (query) {
        const haystack = [
          vehicle.name,
          vehicle.model,
          vehicle.summary,
          vehicle.description,
          ...(vehicle.categories || []).map((c) => c.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      const specs = vehicle.specs || {};
      if (
        filters.transmission !== 'all' &&
        (specs.transmission || '').toLowerCase() !==
          filters.transmission.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.chauffeur !== 'all' &&
        !(specs.chauffeur || '')
          .toLowerCase()
          .includes(filters.chauffeur.toLowerCase())
      ) {
        return false;
      }

      if (minSeatsNum > 0 && (!specs.seats || specs.seats < minSeatsNum)) {
        return false;
      }

      return true;
    });
  }, [vehicles, activeCategory, search, filters]);

  const handleResetAll = () => {
    setSearch('');
    setActiveCategory('all');
    setFilters(INITIAL_FILTERS);
  };

  const handleSelectForEnquiry = (vehicle) => {
    setEnquiryVehicleName(vehicle.name);
    const panel = document.getElementById('quick-enquiry');
    if (panel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3.5 pt-4 pb-6 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7">
        {/* Responsive luxury Hero Banner with auto-carousel across mobile, tablet & desktop */}
        <HeroBanner
          featuredVehicles={featuredVehicles}
          settings={settings}
          loading={loading}
        />

        {/* Subtle client-review banner if no booking channel has been configured yet */}
        {!loading &&
        !settings.whatsappConfigured &&
        !settings.telegramConfigured &&
        !settings.wechatConfigured ? (
          <div
            role="status"
            data-testid="global-whatsapp-disabled-banner"
            className="mb-5 flex items-center gap-2.5 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-3.5 py-2.5 text-xs sm:text-sm text-[var(--text-secondary)]"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[var(--gold-accent)]" />
            <span>
              Booking buttons (WhatsApp, Telegram, WeChat) are currently
              disabled until at least one contact channel is saved in the Staff
              Admin Dashboard.
            </span>
          </div>
        ) : null}

        {/* Error fallback */}
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

        {/* Main 2-column layout on desktop (Fleet left + Quick Enquiry right); mobile-first stacked */}
        <div
          id="fleet"
          className="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:items-start"
        >
          {/* Fleet Column */}
          <section
            aria-labelledby="fleet-heading"
            className="lg:col-span-8 space-y-4 sm:space-y-5"
          >
            {/* Mobile-first search & filter bar at very top on mobile; paired with heading on desktop */}
            <div className="space-y-4">
              <div className="lg:hidden">
                <SearchFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFilterChange={setFilters}
                  onResetAll={handleResetAll}
                  activeFilterCount={activeFilterCount}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2
                    id="fleet-heading"
                    className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
                  >
                    <span className="lg:hidden">Choose Your Journey</span>
                    <span className="hidden lg:inline">Premium Fleet</span>
                  </h2>
                  {!loading ? (
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      Showing {filteredVehicles.length}{' '}
                      {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'}
                      {activeCategory !== 'all' ? ' in selected category' : ''}
                    </p>
                  ) : null}
                </div>

                {/* Desktop search & filter control */}
                <div className="hidden lg:block lg:w-[340px]">
                  <SearchFilterBar
                    search={search}
                    onSearchChange={setSearch}
                    filters={filters}
                    onFilterChange={setFilters}
                    onResetAll={handleResetAll}
                    activeFilterCount={activeFilterCount}
                  />
                </div>
              </div>

              {/* Category filter buttons */}
              <CategoryPills
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
              />
            </div>

            {/* Loading skeletons */}
            {loading ? (
              <div
                aria-label="Loading fleet"
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="card-luxury overflow-hidden rounded-2xl animate-pulse"
                  >
                    <div className="aspect-[16/10] bg-[var(--bg-input)]" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 w-2/3 rounded bg-[var(--bg-input)]" />
                      <div className="flex gap-2">
                        <div className="h-6 w-20 rounded-full bg-[var(--bg-input)]" />
                        <div className="h-6 w-16 rounded-full bg-[var(--bg-input)]" />
                        <div className="h-6 w-20 rounded-full bg-[var(--bg-input)]" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <div className="h-10 flex-1 rounded-full bg-[var(--bg-input)]" />
                        <div className="h-10 w-24 rounded-full bg-[var(--bg-input)]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVehicles.length === 0 ? (
              /* Empty search/filter state */
              <div
                data-testid="empty-fleet-state"
                className="card-luxury flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]">
                  <CarFront className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                  No matching vehicles found
                </h3>
                <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)]">
                  Try clearing your search or adjusting filters — or message our
                  concierge directly on WhatsApp, Telegram, or WeChat for custom
                  Sri Lankan fleet requests.
                </p>
                <div className="mt-5 flex flex-col items-center gap-3 w-full max-w-md">
                  <button
                    type="button"
                    onClick={handleResetAll}
                    data-testid="reset-filters-btn"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 text-[var(--gold-accent)]" />
                    <span>Reset Search &amp; Filters</span>
                  </button>

                  <BookingChannelGroup
                    message={
                      search.trim()
                        ? `Hello Colombo Tours, I’m looking for "${search.trim()}". Could you let me know if you have this vehicle or a similar option available?`
                        : settings.supportGreeting
                    }
                    subjectLabel={
                      search.trim()
                        ? `Custom request: ${search.trim()}`
                        : 'Custom Fleet Request'
                    }
                    whatsappNumber={settings.whatsappNumber}
                    telegramHandle={settings.telegramHandle}
                    wechatId={settings.wechatId}
                    wechatQrUrl={settings.wechatQrUrl}
                    size="xs"
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              /* Single-column on mobile, 2-column grid on tablet/desktop */
              <div
                data-testid="fleet-grid"
                className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2"
              >
                {filteredVehicles.map((vehicle, index) => (
                  <VehicleCard
                    key={vehicle._id || vehicle.slug}
                    vehicle={vehicle}
                    whatsappNumber={settings.whatsappNumber}
                    eager={index < 2}
                    onSelectForEnquiry={handleSelectForEnquiry}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Sticky Right Quick Enquiry Sidebar (desktop) / stacked section (mobile) */}
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <QuickEnquiryPanel
              vehicles={vehicles}
              services={services}
              whatsappNumber={settings.whatsappNumber}
              telegramHandle={settings.telegramHandle}
              wechatId={settings.wechatId}
              wechatQrUrl={settings.wechatQrUrl}
              selectedVehicleName={enquiryVehicleName}
              onClearSelectedVehicle={() => setEnquiryVehicleName('')}
            />
          </div>
        </div>

        {/* Dedicated Sri Lankan Car Rental Services Section */}
        <ServicesSection
          services={services}
          whatsappNumber={settings.whatsappNumber}
        />
      </main>

      <Footer />

      {/* Stacked floating WeChat, Telegram & WhatsApp buttons */}
      <FloatingContactButtons />

      {/* WeChat Booking Concierge Modal */}
      <WeChatEnquiryModal />
    </div>
  );
}
