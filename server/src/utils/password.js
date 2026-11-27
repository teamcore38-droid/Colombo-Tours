import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 72; // bcrypt silently truncates inputs beyond 72 UTF-8 bytes
const isTestRuntime =
  process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
export const BCRYPT_ROUNDS = isTestRuntime ? 4 : 12;

const KNOWN_WEAK_PASSWORDS = new Set([
  'changeme123!',
  'password123!',
  'password1234!',
  'admin123456!',
  'colombotours123!',
  'qwerty123456!',
  'welcome12345!',
  'letmein12345!',
]);

const PLACEHOLDER_SECRET_MARKERS = [
  'replace-with',
  'change-me',
  'changeme',
  'colombo-tours-local-dev-secret',
  'your-secret',
  'secret-key',
  'example',
  'default',
];

let cachedDummyHash = null;

/**
 * Returns a valid bcrypt hash for constant-time login comparison when an email
 * does not exist, eliminating email-enumeration timing side-channels.
 */
function getDummyPasswordHash() {
  if (!cachedDummyHash) {
    cachedDummyHash = bcrypt.hashSync(
      'ColomboTours#DummyTimingGuard!2026',
      BCRYPT_ROUNDS
    );
  }
  return cachedDummyHash;
}

export function isPasswordWithinByteLimit(password) {
  return (
    typeof password === 'string' &&
    Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES
  );
}

/**
 * Strict password policy for admin/staff password changes, resets, and production bootstrap.
 */
export function validateNewPassword(
  password,
  { email = '', currentPassword = '' } = {}
) {
  if (typeof password !== 'string' || !password) {
    return { valid: false, error: 'New password is required.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    };
  }

  if (!isPasswordWithinByteLimit(password)) {
    return {
      valid: false,
      error: `New password must not exceed ${MAX_PASSWORD_BYTES} bytes.`,
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'New password must include at least one uppercase letter.',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'New password must include at least one lowercase letter.',
    };
  }

  if (!/\d/.test(password)) {
    return {
      valid: false,
      error: 'New password must include at least one number.',
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      error: 'New password must include at least one special character.',
    };
  }

  const normalized = password.trim().toLowerCase();
  if (KNOWN_WEAK_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      error: 'Please choose a stronger password that is not a common default.',
    };
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail) {
    const localPart = cleanEmail.split('@')[0] || '';
    if (
      normalized.includes(cleanEmail) ||
      (localPart.length >= 4 && normalized.includes(localPart))
    ) {
      return {
        valid: false,
        error: 'New password must not contain your email address or username.',
      };
    }
  }

  if (currentPassword && password === currentPassword) {
    return {
      valid: false,
      error: 'New password must be different from your current password.',
    };
  }

  return { valid: true, error: '' };
}

export async function hashPassword(password) {
  if (!isPasswordWithinByteLimit(password)) {
    throw new Error(`Password must not exceed ${MAX_PASSWORD_BYTES} bytes.`);
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (
    typeof password !== 'string' ||
    !password ||
    !isPasswordWithinByteLimit(password) ||
    typeof passwordHash !== 'string' ||
    !passwordHash
  ) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}

/**
 * Runs a dummy bcrypt comparison with identical work factor when a login email
 * is unknown so response timing matches an existing account check.
 */
export async function runDummyPasswordCheck(password) {
  const safeInput =
    typeof password === 'string' && isPasswordWithinByteLimit(password)
      ? password
      : 'dummy-invalid-input';
  await bcrypt.compare(safeInput, getDummyPasswordHash());
}

/**
 * Detects missing, short, low-entropy, or placeholder JWT secrets in production.
 */
export function isWeakOrPlaceholderSecret(secret) {
  if (typeof secret !== 'string') return true;
  const trimmed = secret.trim();
  if (trimmed.length < 32) return true;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_SECRET_MARKERS.some((marker) => lower.includes(marker))) {
    return true;
  }
  const uniqueChars = new Set(trimmed).size;
  if (uniqueChars < 10) return true;
  return false;
}

/**
 * Generates a cryptographically strong password guaranteed to satisfy validateNewPassword.
 */
export function generateStrongPassword(length = 20) {
  const targetLen = Math.max(MIN_PASSWORD_LENGTH, Math.min(length, 48));
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+?';
  const all = upper + lower + digits + symbols;

  const pick = (charset) => charset[crypto.randomInt(0, charset.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < targetLen) {
    chars.push(pick(all));
  }
  // Fisher-Yates shuffle using CSPRNG
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
