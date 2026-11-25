import { Router } from 'express';
import { connectDB } from '../config/db.js';
import { Vehicle } from '../models/Vehicle.js';
import { ensureBootstrapped } from '../utils/seed.js';

const SAFE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_HOST_REGEX = /^[a-z0-9.-]+(?::\d{1,5})?$/i;
const PREVIEW_BOT_REGEX =
  /whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|applebot|micromessenger|wechat|googlebot|bingbot|skypeuripreview|viber|kakaotalk|line\//i;

export function sanitizeVehicleSlug(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length > 150) return '';
  return SAFE_SLUG_REGEX.test(cleaned) ? cleaned : '';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPreviewCrawler(req) {
  const ua = String(req.get('user-agent') || '');
  return PREVIEW_BOT_REGEX.test(ua);
}

function resolveRequestOrigin(req) {
  const rawHost = String(
    req.get('x-forwarded-host') || req.get('host') || ''
  )
    .split(',')[0]
    .trim();

  if (!rawHost || !SAFE_HOST_REGEX.test(rawHost)) {
    return 'https://colombo-tours.vercel.app';
  }

  const isLocal =
    rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1');
  const protoHeader = String(req.get('x-forwarded-proto') || req.protocol || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = isLocal && protoHeader === 'http' ? 'http' : 'https';
  return `${proto}://${rawHost}`;
}

/**
 * Formats a vehicle photo URL into a WhatsApp/Telegram-compatible JPEG Open Graph image
 * (WhatsApp ignores WebP/SVG OG images and requires <600 KB JPG/PNG with absolute HTTPS URLs).
 */
export function buildOgImageUrl(rawUrl, origin) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500 || /\s/.test(trimmed)) return '';

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return `${origin}${trimmed}`;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https:') return '';

  const str = parsed.toString();
  if (parsed.hostname.toLowerCase() === 'res.cloudinary.com') {
    const marker = '/image/upload/';
    const idx = str.indexOf(marker);
    if (idx !== -1) {
      const after = str.slice(idx + marker.length);
      const stripped = /^(?:f_|q_|w_|h_|c_|g_|t_)[^/]+\//.test(after)
        ? after.replace(/^[^/]+\//, '')
        : after;
      const jpgPath = stripped.replace(/\.webp(\?.*)?$/i, '.jpg$1');
      return `${str.slice(0, idx + marker.length)}f_jpg,q_auto:good,w_1200,h_630,c_fill,g_auto/${jpgPath}`;
    }
  }

  return str;
}

function buildVehicleSummary(vehicle) {
  const parts = [];
  const name = String(vehicle?.name || '').trim();
  const model = String(vehicle?.model || '').trim();
  const specs = vehicle?.specs || {};

  if (model && model.toLowerCase() !== name.toLowerCase()) {
    parts.push(model);
  }
  if (specs.seats) parts.push(`${specs.seats} Seats`);
  if (specs.transmission) parts.push(String(specs.transmission).trim());
  if (specs.luggage) parts.push(String(specs.luggage).trim());
  if (specs.fuelType) parts.push(String(specs.fuelType).trim());
  if (specs.chauffeur) parts.push(String(specs.chauffeur).trim());

  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return (
    String(vehicle?.summary || '').trim() ||
    'Chauffeur-driven luxury vehicle rental in Sri Lanka by Colombo Tours.'
  );
}

export function createShareRouter({ skipDbMiddleware = false } = {}) {
  const router = Router();

  router.get('/:slug', async (req, res, next) => {
    try {
      const safeSlug = sanitizeVehicleSlug(req.params.slug);
      // Never mix crawler OG HTML with human redirects across shared CDN caches
      res.set('Cache-Control', 'no-store');

      if (!safeSlug) {
        return res.redirect(302, '/');
      }

      const targetPath = `/vehicle/${encodeURIComponent(safeSlug)}`;

      // Fast 0-DB redirect for real human visitors clicking the short vehicle link
      if (!isPreviewCrawler(req)) {
        return res.redirect(302, targetPath);
      }

      if (!skipDbMiddleware) {
        await connectDB();
        await ensureBootstrapped();
      }

      const vehicle = await Vehicle.findOne({
        slug: safeSlug,
        isPublished: true,
      })
        .select('name model slug summary specs photos')
        .lean();

      if (!vehicle) {
        return res.redirect(302, '/');
      }

      const origin = resolveRequestOrigin(req);
      const shareUrl = `${origin}/v/${encodeURIComponent(safeSlug)}`;
      const title = `${vehicle.name} — Colombo Tours`;
      const description = buildVehicleSummary(vehicle);
      const primaryPhoto =
        (vehicle.photos || []).find((p) => p?.isPrimary) ||
        (vehicle.photos || [])[0];
      const ogImage = primaryPhoto?.url
        ? buildOgImageUrl(primaryPhoto.url, origin)
        : '';

      const safeTitle = escapeHtml(title);
      const safeDesc = escapeHtml(description);
      const safeShareUrl = escapeHtml(shareUrl);
      const safeTargetPath = escapeHtml(targetPath);
      const safeName = escapeHtml(vehicle.name);

      const imageMeta = ogImage
        ? `
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
        : '';

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="canonical" href="${safeShareUrl}" />
  <meta property="og:site_name" content="Colombo Tours" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${safeShareUrl}" />${imageMeta}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
</head>
<body>
  <main>
    <h1>${safeName}</h1>
    <p>${safeDesc}</p>
    <p><a href="${safeTargetPath}">View ${safeName} on Colombo Tours</a></p>
  </main>
</body>
</html>`;

      res.set('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (error) {
      return next(error);
    }
  });

  router.use((_req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, '/');
  });

  return router;
}
