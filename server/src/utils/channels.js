/**
 * Strict normalization & validation for Colombo Tours booking channels:
 * - WhatsApp: E.164 international phone digits OR official https:// WhatsApp link (wa.me / whatsapp.com)
 * - Telegram: Official @username / E.164 phone OR official https:// Telegram link (t.me / telegram.me / telegram.dog)
 * - WeChat: WeChat ID / E.164 phone / safe QR URL OR official https:// WeChat link (u.wechat.com / weixin.qq.com)
 */
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
  // Require a non-empty path (e.g. /message/..., /COLOMBOTOURS, /kHm8...)
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
  const digits = normalizeWhatsAppNumber(raw);
  return E164_DIGITS_REGEX.test(digits);
}

export function formatWhatsAppDisplay(raw) {
  const digits = normalizeWhatsAppNumber(raw);
  if (!digits) return '';
  return `+${digits}`;
}

export function sanitizeWhatsAppLink(raw) {
  return sanitizeAllowedHttpsLink(raw, WHATSAPP_HOSTS);
}

export function isValidWhatsAppLink(raw) {
  return Boolean(sanitizeWhatsAppLink(raw));
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
