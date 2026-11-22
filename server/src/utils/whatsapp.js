/**
 * Strict E.164 international phone normalization & validation for WhatsApp wa.me links.
 * Accepts formatted input like "+94 77 123 4567" or "0094-77-123-4567" -> "94771234567".
 */
const E164_DIGITS_REGEX = /^[1-9]\d{7,14}$/;

export function normalizeWhatsAppNumber(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned) return '';

  // Remove international exit prefix "00" if present (e.g. 0094...)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }
  // Keep digits only
  const digits = cleaned.replace(/\D/g, '');
  return digits;
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
