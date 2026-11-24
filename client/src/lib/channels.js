const E164_DIGITS_REGEX = /^[1-9]\d{7,14}$/;
const TELEGRAM_USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/;
const TELEGRAM_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const WECHAT_ID_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/;
const WECHAT_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

const WHATSAPP_HOSTS = new Set([
  'wa.me',
  'api.whatsapp.com',
  'chat.whatsapp.com',
  'whatsapp.com',
  'www.whatsapp.com',
]);

const TELEGRAM_HOSTS = new Set([
  't.me',
  'www.t.me',
  'telegram.me',
  'www.telegram.me',
  'telegram.dog',
]);

const WECHAT_HOSTS = new Set([
  'u.wechat.com',
  'weixin.qq.com',
  'work.weixin.qq.com',
  'mp.weixin.qq.com',
]);

function sanitizeAllowedHttpsLink(raw, allowedHosts) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500 || /\s/.test(trimmed)) return '';

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:') return '';
  const host = parsed.hostname.toLowerCase();
  if (!allowedHosts.has(host)) return '';
  if (!parsed.pathname || parsed.pathname === '/') return '';

  return parsed.toString();
}

// --- WhatsApp ---
export function normalizeWhatsAppNumber(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }
  return cleaned.replace(/\D/g, '');
}

export function isValidWhatsAppNumber(raw) {
  return E164_DIGITS_REGEX.test(normalizeWhatsAppNumber(raw));
}

export function sanitizeWhatsAppLink(raw) {
  return sanitizeAllowedHttpsLink(raw, WHATSAPP_HOSTS);
}

export function isValidWhatsAppLink(raw) {
  return Boolean(sanitizeWhatsAppLink(raw));
}

export function buildWhatsAppUrl(rawNumber, message) {
  const digits = normalizeWhatsAppNumber(rawNumber);
  if (!E164_DIGITS_REGEX.test(digits)) {
    return null;
  }
  const encoded = encodeURIComponent(String(message || '').trim());
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function resolveWhatsAppUrl({
  whatsappNumber = '',
  whatsappLink = '',
  whatsappMode = 'number',
  whatsappEnabled = true,
  message = '',
} = {}) {
  if (whatsappEnabled === false) return null;
  if (whatsappMode === 'link') {
    const safeLink = sanitizeWhatsAppLink(whatsappLink);
    return safeLink || null;
  }
  return buildWhatsAppUrl(whatsappNumber, message);
}

// --- Telegram ---
export function normalizeTelegramHandle(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';

  cleaned = cleaned.replace(
    /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i,
    ''
  );
  cleaned = cleaned.replace(/^(?:t\.me|telegram\.me|telegram\.dog)\//i, '');
  cleaned = cleaned.split(/[?#]/)[0].replace(/\/+$/, '').trim();
  if (!cleaned) return '';

  if (cleaned.startsWith('@')) {
    return cleaned.slice(1).trim();
  }

  if (/^(?:\+|00)?[\d\s\-()]+$/.test(cleaned)) {
    const digits = normalizeWhatsAppNumber(cleaned);
    return digits ? `+${digits}` : '';
  }

  return cleaned;
}

export function isValidTelegramHandle(raw) {
  const normalized = normalizeTelegramHandle(raw);
  if (!normalized) return false;
  if (normalized.startsWith('+')) {
    return TELEGRAM_PHONE_REGEX.test(normalized);
  }
  return TELEGRAM_USERNAME_REGEX.test(normalized);
}

export function formatTelegramDisplay(raw) {
  const normalized = normalizeTelegramHandle(raw);
  if (!normalized) return '';
  return normalized.startsWith('+') ? normalized : `@${normalized}`;
}

export function sanitizeTelegramLink(raw) {
  return sanitizeAllowedHttpsLink(raw, TELEGRAM_HOSTS);
}

export function isValidTelegramLink(raw) {
  return Boolean(sanitizeTelegramLink(raw));
}

export function buildTelegramUrl(rawHandle, message) {
  const normalized = normalizeTelegramHandle(rawHandle);
  if (!isValidTelegramHandle(normalized)) {
    return null;
  }
  const encoded = encodeURIComponent(String(message || '').trim());
  return `https://t.me/${normalized}?text=${encoded}`;
}

export function resolveTelegramUrl({
  telegramHandle = '',
  telegramLink = '',
  telegramMode = 'handle',
  telegramEnabled = true,
  message = '',
} = {}) {
  if (telegramEnabled === false) return null;
  if (telegramMode === 'link') {
    const safeLink = sanitizeTelegramLink(telegramLink);
    if (!safeLink) return null;
    try {
      const parsed = new URL(safeLink);
      const pathSegment = parsed.pathname.replace(/^\/+|\/+$/g, '');
      const trimmedMsg = String(message || '').trim();
      // If link points directly to a Telegram username (not an invite +link) with no existing query, attach pre-filled text
      if (
        trimmedMsg &&
        !parsed.search &&
        TELEGRAM_USERNAME_REGEX.test(pathSegment)
      ) {
        return `${safeLink}?text=${encodeURIComponent(trimmedMsg)}`;
      }
    } catch {
      // return sanitized link as-is
    }
    return safeLink;
  }
  return buildTelegramUrl(telegramHandle, message);
}

// --- WeChat ---
export function normalizeWeChatId(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';

  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1).trim();
  }

  if (/^(?:\+|00)?[\d\s\-()]+$/.test(cleaned)) {
    const digits = normalizeWhatsAppNumber(cleaned);
    return digits ? `+${digits}` : '';
  }

  return cleaned;
}

export function isValidWeChatId(raw) {
  const normalized = normalizeWeChatId(raw);
  if (!normalized) return false;
  if (normalized.startsWith('+')) {
    return WECHAT_PHONE_REGEX.test(normalized);
  }
  return WECHAT_ID_REGEX.test(normalized);
}

export function sanitizeWeChatLink(raw) {
  return sanitizeAllowedHttpsLink(raw, WECHAT_HOSTS);
}

export function isValidWeChatLink(raw) {
  return Boolean(sanitizeWeChatLink(raw));
}

export function isSafeQrUrl(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !/\s/.test(trimmed)) {
    return true;
  }
  return /^https:\/\/[^\s]+$/i.test(trimmed);
}

export function isWeChatConfigured(wechatId, wechatQrUrl) {
  return isValidWeChatId(wechatId) || isSafeQrUrl(wechatQrUrl);
}

export function resolveWeChatAction({
  wechatId = '',
  wechatLink = '',
  wechatQrUrl = '',
  wechatMode = 'id',
  wechatEnabled = true,
} = {}) {
  if (wechatEnabled === false) {
    return { active: false, mode: wechatMode, url: null };
  }
  if (wechatMode === 'link') {
    const safeLink = sanitizeWeChatLink(wechatLink);
    if (!safeLink) {
      return { active: false, mode: 'link', url: null };
    }
    return { active: true, mode: 'link', url: safeLink };
  }
  const hasModalData = isWeChatConfigured(wechatId, wechatQrUrl);
  return {
    active: hasModalData,
    mode: 'id',
    url: null,
    wechatId: isValidWeChatId(wechatId) ? normalizeWeChatId(wechatId) : '',
    wechatQrUrl: isSafeQrUrl(wechatQrUrl) ? wechatQrUrl.trim() : '',
    wechatLink: sanitizeWeChatLink(wechatLink),
  };
}

// --- Shareable Vehicle Link & Details Helpers ---
const SAFE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeVehicleSlug(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length > 150) return '';
  return SAFE_SLUG_REGEX.test(cleaned) ? cleaned : '';
}

export function buildVehicleShareUrl(slug, originOverride = '') {
  const safeSlug = sanitizeVehicleSlug(slug);
  if (!safeSlug) return '';

  const rawOrigin =
    originOverride ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '');
  if (!rawOrigin) return '';

  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return `${parsed.origin}/?vehicle=${encodeURIComponent(safeSlug)}`;
  } catch {
    return '';
  }
}

export function formatVehicleDetailsSummary(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') return '';
  const parts = [];
  const name = String(vehicle.name || '').trim();
  const model = String(vehicle.model || '').trim();
  const specs = vehicle.specs || {};

  if (model && model.toLowerCase() !== name.toLowerCase()) {
    parts.push(model);
  }
  if (specs.seats) {
    parts.push(`${specs.seats} Seats`);
  }
  if (specs.transmission) {
    parts.push(String(specs.transmission).trim());
  }
  if (specs.luggage) {
    parts.push(String(specs.luggage).trim());
  }
  if (specs.fuelType) {
    parts.push(String(specs.fuelType).trim());
  }
  if (specs.chauffeur) {
    parts.push(String(specs.chauffeur).trim());
  }

  return parts.filter(Boolean).join(' · ');
}

// --- Enquiry Message Builders (Always English so staff read bookings clearly) ---
export function buildVehicleEnquiryMessage(vehicleOrName, options = {}) {
  const vehicleObj =
    vehicleOrName && typeof vehicleOrName === 'object'
      ? vehicleOrName
      : options.vehicle && typeof options.vehicle === 'object'
        ? options.vehicle
        : null;

  const name = String(
    (typeof vehicleOrName === 'string' ? vehicleOrName : vehicleObj?.name) ||
      'a vehicle'
  ).trim();

  const details =
    String(options.details || '').trim() ||
    formatVehicleDetailsSummary(vehicleObj);
  const vehicleUrl =
    String(options.vehicleUrl || '').trim() ||
    buildVehicleShareUrl(vehicleObj?.slug || options.slug || '', options.origin);

  const hasExtras =
    Boolean(details) ||
    Boolean(vehicleUrl) ||
    Boolean(options.pickupLocation?.trim()) ||
    Boolean(options.pickupDate?.trim()) ||
    Boolean(options.returnDate?.trim()) ||
    Boolean(options.chauffeurPreferred);

  if (!hasExtras) {
    return `Hello Colombo Tours, I’m interested in renting the ${name}. Could you confirm availability and share the rate?`;
  }

  const lines = [`Hello Colombo Tours, I’m interested in renting the ${name}.`];
  if (details) {
    lines.push(`Details: ${details}`);
  }
  if (vehicleUrl) {
    lines.push(`Vehicle link: ${vehicleUrl}`);
  }
  if (options.pickupLocation?.trim()) {
    lines.push(`Pickup location: ${options.pickupLocation.trim()}`);
  }
  if (options.pickupDate?.trim()) {
    lines.push(`Pickup date: ${options.pickupDate.trim()}`);
  }
  if (options.returnDate?.trim()) {
    lines.push(`Return date: ${options.returnDate.trim()}`);
  }
  if (options.chauffeurPreferred) {
    lines.push('Preference: With professional chauffeur');
  }
  lines.push('Could you confirm availability and share the rate?');
  return lines.join('\n');
}

export function buildServiceEnquiryMessage(serviceName, options = {}) {
  const name = String(serviceName || 'car rental service').trim();
  const hasExtras =
    Boolean(options.pickupLocation?.trim()) ||
    Boolean(options.pickupDate?.trim()) ||
    Boolean(options.returnDate?.trim());

  if (!hasExtras) {
    return `Hello Colombo Tours, I’m interested in your ${name}. Could you confirm availability and share the rate?`;
  }

  const lines = [`Hello Colombo Tours, I’m interested in your ${name}.`];
  if (options.pickupLocation?.trim()) {
    lines.push(`Pickup location: ${options.pickupLocation.trim()}`);
  }
  if (options.pickupDate?.trim()) {
    lines.push(`Pickup date: ${options.pickupDate.trim()}`);
  }
  if (options.returnDate?.trim()) {
    lines.push(`Return date: ${options.returnDate.trim()}`);
  }
  lines.push('Could you confirm availability and share the rate?');
  return lines.join('\n');
}

export function buildQuickEnquiryMessage({
  targetType = 'general',
  targetName = '',
  vehicle = null,
  origin = '',
  pickupLocation = '',
  pickupDate = '',
  returnDate = '',
  chauffeurPreferred = false,
} = {}) {
  if (targetType === 'vehicle' && (targetName || vehicle)) {
    return buildVehicleEnquiryMessage(vehicle || targetName, {
      vehicle,
      origin,
      pickupLocation,
      pickupDate,
      returnDate,
      chauffeurPreferred,
    });
  }

  if (targetType === 'service' && targetName) {
    return buildServiceEnquiryMessage(targetName, {
      pickupLocation,
      pickupDate,
      returnDate,
    });
  }

  const lines = ['Hello Colombo Tours, I’m interested in renting a vehicle.'];
  if (pickupLocation.trim()) {
    lines.push(`Pickup location: ${pickupLocation.trim()}`);
  }
  if (pickupDate.trim()) {
    lines.push(`Pickup date: ${pickupDate.trim()}`);
  }
  if (returnDate.trim()) {
    lines.push(`Return date: ${returnDate.trim()}`);
  }
  if (chauffeurPreferred) {
    lines.push('Preference: With professional chauffeur');
  }
  lines.push('Could you confirm availability and share the rate?');
  return lines.join('\n');
}

/**
 * Validates optional rental dates in YYYY-MM-DD format against today's local date.
 */
export function validateRentalDates(pickupDate, returnDate, todayIso) {
  const today =
    todayIso ||
    (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (pickupDate) {
    if (!isoRegex.test(pickupDate)) {
      return 'Please select a valid pickup date.';
    }
    if (pickupDate < today) {
      return 'Pickup date cannot be in the past.';
    }
  }

  if (returnDate) {
    if (!isoRegex.test(returnDate)) {
      return 'Please select a valid return date.';
    }
    if (returnDate < today) {
      return 'Return date cannot be in the past.';
    }
    if (pickupDate && returnDate < pickupDate) {
      return 'Return date cannot be earlier than the pickup date.';
    }
  }

  return '';
}
