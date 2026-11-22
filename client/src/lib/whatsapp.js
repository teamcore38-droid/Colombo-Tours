const E164_DIGITS_REGEX = /^[1-9]\d{7,14}$/;

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

export function buildWhatsAppUrl(rawNumber, message) {
  const digits = normalizeWhatsAppNumber(rawNumber);
  if (!E164_DIGITS_REGEX.test(digits)) {
    return null;
  }
  const encoded = encodeURIComponent(String(message || '').trim());
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function buildVehicleEnquiryMessage(vehicleName, options = {}) {
  const name = String(vehicleName || 'a vehicle').trim();
  const lines = [];

  const hasExtras =
    Boolean(options.pickupLocation?.trim()) ||
    Boolean(options.pickupDate?.trim()) ||
    Boolean(options.returnDate?.trim()) ||
    Boolean(options.chauffeurPreferred);

  if (!hasExtras) {
    return `Hello Colombo Tours, I’m interested in renting the ${name}. Could you confirm availability and share the rate?`;
  }

  lines.push(`Hello Colombo Tours, I’m interested in renting the ${name}.`);
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
  pickupLocation = '',
  pickupDate = '',
  returnDate = '',
  chauffeurPreferred = false,
} = {}) {
  if (targetType === 'vehicle' && targetName) {
    return buildVehicleEnquiryMessage(targetName, {
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
