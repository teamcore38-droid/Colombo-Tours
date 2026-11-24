import { AlertCircle, Calendar, Car, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOptionalSite } from '../context/SiteContext';
import {
  buildQuickEnquiryMessage,
  isValidTelegramHandle,
  isValidWhatsAppNumber,
  isWeChatConfigured,
  validateRentalDates,
} from '../lib/channels';
import { BookingChannelGroup } from './ChannelButtons';

const SRI_LANKA_LOCATIONS = [
  'Bandaranaike International Airport (CMB)',
  'Colombo City',
  'Negombo',
  'Kandy',
  'Galle & Unawatuna',
  'Bentota',
  'Ella',
  'Sigiriya / Cultural Triangle',
];

function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function QuickEnquiryPanel({
  vehicles = [],
  services = [],
  whatsappNumber,
  telegramHandle,
  wechatId,
  wechatQrUrl,
  selectedVehicleName = '',
  onClearSelectedVehicle,
}) {
  const site = useOptionalSite();
  const [selectedTarget, setSelectedTarget] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [chauffeurPreferred, setChauffeurPreferred] = useState(true);

  const todayIso = useMemo(() => getTodayIso(), []);
  const effectiveTarget = selectedVehicleName
    ? `vehicle:${selectedVehicleName}`
    : selectedTarget;

  const dateError = useMemo(
    () => validateRentalDates(pickupDate, returnDate, todayIso),
    [pickupDate, returnDate, todayIso]
  );

  const { targetType, targetName } = useMemo(() => {
    if (!effectiveTarget) {
      return { targetType: 'general', targetName: '' };
    }
    if (effectiveTarget.startsWith('vehicle:')) {
      return {
        targetType: 'vehicle',
        targetName: effectiveTarget.slice('vehicle:'.length),
      };
    }
    if (effectiveTarget.startsWith('service:')) {
      return {
        targetType: 'service',
        targetName: effectiveTarget.slice('service:'.length),
      };
    }
    return { targetType: 'general', targetName: '' };
  }, [effectiveTarget]);

  const message = useMemo(
    () =>
      buildQuickEnquiryMessage({
        targetType,
        targetName,
        pickupLocation,
        pickupDate,
        returnDate,
        chauffeurPreferred,
      }),
    [
      targetType,
      targetName,
      pickupLocation,
      pickupDate,
      returnDate,
      chauffeurPreferred,
    ]
  );

  const effectiveWa =
    whatsappNumber !== undefined
      ? whatsappNumber
      : site?.settings?.whatsappNumber || '';
  const effectiveTg =
    telegramHandle !== undefined
      ? telegramHandle
      : site?.settings?.telegramHandle || '';
  const effectiveWcId =
    wechatId !== undefined ? wechatId : site?.settings?.wechatId || '';
  const effectiveWcQr =
    wechatQrUrl !== undefined ? wechatQrUrl : site?.settings?.wechatQrUrl || '';

  const hasAnyChannel =
    isValidWhatsAppNumber(effectiveWa) ||
    isValidTelegramHandle(effectiveTg) ||
    isWeChatConfigured(effectiveWcId, effectiveWcQr);

  const handleTargetChange = (value) => {
    if (selectedVehicleName && onClearSelectedVehicle) {
      onClearSelectedVehicle();
    }
    setSelectedTarget(value);
  };

  return (
    <aside
      id="quick-enquiry"
      aria-label="Quick WhatsApp Enquiry"
      className="card-luxury rounded-2xl p-5"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Quick Enquiry
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
          Optional pickup details are added straight into your WhatsApp,
          Telegram, or WeChat booking message.
        </p>
      </div>

      <div className="space-y-3.5">
        {/* Vehicle or Service selector */}
        <div>
          <label
            htmlFor="qe-target"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
          >
            <Car className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
            <span>Vehicle or Service (optional)</span>
          </label>
          <select
            id="qe-target"
            value={effectiveTarget}
            onChange={(e) => handleTargetChange(e.target.value)}
            data-testid="quick-enquiry-target"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
          >
            <option value="">Any Vehicle / General Enquiry</option>
            {vehicles.length > 0 ? (
              <optgroup label="Vehicles">
                {vehicles.map((v) => (
                  <option key={v._id || v.slug} value={`vehicle:${v.name}`}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {services.length > 0 ? (
              <optgroup label="Services">
                {services.map((s) => (
                  <option
                    key={s._id || s.slug}
                    value={`service:${s.whatsappLabel || s.name}`}
                  >
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>

        {/* Pickup Location */}
        <div>
          <label
            htmlFor="qe-location"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
          >
            <MapPin className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
            <span>Pickup Location (optional)</span>
          </label>
          <input
            id="qe-location"
            type="text"
            list="sri-lanka-locations"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            placeholder="e.g., Airport (CMB), Colombo, Kandy..."
            data-testid="quick-enquiry-location"
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-gold-strong)] focus:outline-none"
          />
          <datalist id="sri-lanka-locations">
            {SRI_LANKA_LOCATIONS.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </div>

        {/* Rental Dates */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div>
            <label
              htmlFor="qe-pickup-date"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              <Calendar className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
              <span>Pickup Date</span>
            </label>
            <input
              id="qe-pickup-date"
              type="date"
              min={todayIso}
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              data-testid="quick-enquiry-pickup-date"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-xs sm:text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="qe-return-date"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              <Calendar className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
              <span>Return Date</span>
            </label>
            <input
              id="qe-return-date"
              type="date"
              min={pickupDate || todayIso}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              data-testid="quick-enquiry-return-date"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-xs sm:text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
            />
          </div>
        </div>

        {/* Inline date validation alert */}
        {dateError ? (
          <div
            role="alert"
            data-testid="quick-enquiry-date-error"
            className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-500 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{dateError}</span>
          </div>
        ) : null}

        {/* Chauffeur preference checkbox */}
        <label className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-xs sm:text-sm text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={chauffeurPreferred}
            onChange={(e) => setChauffeurPreferred(e.target.checked)}
            className="h-4 w-4 rounded accent-[#D4AF37]"
          />
          <span>Include professional English-speaking chauffeur</span>
        </label>

        {/* Submit via WhatsApp, Telegram, or WeChat */}
        <div className="pt-1 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Send Enquiry Via
          </p>
          <BookingChannelGroup
            message={message}
            subjectLabel={targetName || 'Quick Booking Enquiry'}
            whatsappNumber={effectiveWa}
            telegramHandle={effectiveTg}
            wechatId={effectiveWcId}
            wechatQrUrl={effectiveWcQr}
            disabled={Boolean(dateError)}
            size="xs"
            whatsappTestId="quick-enquiry-whatsapp-btn"
            telegramTestId="quick-enquiry-telegram-btn"
            wechatTestId="quick-enquiry-wechat-btn"
          />

          {!hasAnyChannel ? (
            <p
              data-testid="whatsapp-unconfigured-notice"
              className="mt-2.5 rounded-lg border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]"
            >
              Booking buttons are currently paused until Colombo Tours
              configures WhatsApp, Telegram, or WeChat in the Admin Dashboard.
            </p>
          ) : (
            <p className="mt-1 text-center text-[11px] text-[var(--text-muted)]">
              Instant response · Rates &amp; availability confirmed directly on
              your chosen app
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
