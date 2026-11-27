import { env } from '../config/env.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SAFE_HOST_REGEX = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

function extractRequestSelfOrigin(req) {
  const rawHost = String(
    req.get('x-forwarded-host') || req.get('host') || ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase();

  if (!rawHost || !SAFE_HOST_REGEX.test(rawHost)) {
    return null;
  }

  const isLocal =
    rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1');
  const protoHeader = String(req.get('x-forwarded-proto') || req.protocol || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  const proto =
    env.isProduction && !isLocal
      ? 'https'
      : protoHeader === 'https'
        ? 'https'
        : 'http';

  return `${proto}://${rawHost}`;
}

function isOriginAllowed(origin, req, allowedOrigins) {
  if (!origin || typeof origin !== 'string') return false;
  let normalized;
  try {
    normalized = new URL(origin).origin.toLowerCase();
  } catch {
    return false;
  }

  if (allowedOrigins) {
    for (const entry of allowedOrigins) {
      if (String(entry).toLowerCase() === normalized) {
        return true;
      }
    }
  }

  const selfOrigin = extractRequestSelfOrigin(req);
  if (selfOrigin && normalized === selfOrigin) {
    return true;
  }

  // In local dev/test, also allow http/https self-host equivalence
  if (!env.isProduction && selfOrigin) {
    const rawHost = selfOrigin.replace(/^https?:\/\//, '');
    if (normalized === `http://${rawHost}` || normalized === `https://${rawHost}`) {
      return true;
    }
  }

  return false;
}

/**
 * Defense-in-depth CSRF protection for cookie-authenticated auth/admin routes.
 * - Rejects cross-site Fetch Metadata (Sec-Fetch-Site: cross-site) unless explicitly allowlisted
 * - Enforces exact Origin/Referer match against same-origin or allowedOrigins
 * - Rejects simple HTML form Content-Types (application/x-www-form-urlencoded, text/plain)
 *   so classic cross-site/same-site form submissions cannot invoke admin mutations
 */
export function createSameOriginGuard(allowedOrigins) {
  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) {
      return next();
    }

    const contentType = String(req.get('content-type') || '').toLowerCase();
    if (
      contentType.startsWith('application/x-www-form-urlencoded') ||
      contentType.startsWith('text/plain')
    ) {
      return res.status(415).json({
        error: 'Unsupported content type. JSON request body required.',
      });
    }

    const origin = req.get('origin');
    const referer = req.get('referer');
    const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();

    if (origin) {
      if (!isOriginAllowed(origin, req, allowedOrigins)) {
        return res
          .status(403)
          .json({ error: 'Cross-origin request blocked.' });
      }
      return next();
    }

    if (fetchSite === 'cross-site') {
      return res.status(403).json({ error: 'Cross-site request blocked.' });
    }

    if (referer) {
      if (!isOriginAllowed(referer, req, allowedOrigins)) {
        return res
          .status(403)
          .json({ error: 'Cross-origin request blocked.' });
      }
    }

    return next();
  };
}
