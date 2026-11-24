/**
 * Strict normalization & validation for Colombo Tours booking channels:
 * - WhatsApp: E.164 international phone digits (e.g. "+94 77 123 4567" -> "94771234567")
 * - Telegram: Official @username (5–32 chars) OR E.164 international phone (e.g. "+94771234567")
 * - WeChat: WeChat ID (6–20 chars starting with a letter) OR E.164 international phone, plus optional safe QR URL
 */
const E164_DIGITS_REGEX = /^[1-9]\d{7,14}$/;
const TELEGRAM_USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/;
const TELEGRAM_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const WECHAT_ID_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/;
const WECHAT_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

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
  const digits = normalizeWhatsAppNumber(raw);
  return E164_DIGITS_REGEX.test(digits);
}

export function formatWhatsAppDisplay(raw) {
  const digits = normalizeWhatsAppNumber(raw);
  if (!digits) return '';
  return `+${digits}`;
}

/**
 * Normalizes Telegram input:
 * - "https://t.me/ColomboTours", "@ColomboTours", "ColomboTours" -> "ColomboTours"
 * - "https://t.me/+94771234567", "+94 77 123 4567", "0094771234567" -> "+94771234567"
 */
export function normalizeTelegramHandle(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';

  // Strip t.me / telegram.me prefixes if staff pasted a full link
  cleaned = cleaned.replace(
    /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i,
    ''
  );
  cleaned = cleaned.replace(/^(?:t\.me|telegram\.me)\//i, '');
  // Strip query string / trailing slashes
  cleaned = cleaned.split(/[?#]/)[0].replace(/\/+$/, '').trim();

  if (!cleaned) return '';

  // Strip leading "@" for usernames
  if (cleaned.startsWith('@')) {
    return cleaned.slice(1).trim();
  }

  // Phone number form (starts with "+" or "00" or digits/separators only)
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

/**
 * Normalizes WeChat ID or international phone number.
 * - "ColomboTours_LK" -> "ColomboTours_LK"
 * - "+94 77 123 4567" / "0094771234567" -> "+94771234567"
 */
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

/**
 * Allows only safe relative site/API paths or HTTPS URLs for uploaded WeChat QR images.
 * Blocks javascript:, data:, whitespace, and arbitrary non-HTTP schemes.
 */
export function sanitizeSafeImageUrl(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > 500) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !/\s/.test(trimmed)) {
    return trimmed;
  }
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}
