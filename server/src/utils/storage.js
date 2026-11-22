import { env } from '../config/env.js';
import { Media } from '../models/Media.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

/**
 * Inspect file magic bytes to verify genuine image binary content.
 */
export function detectImageMimeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  // AVIF: ....ftypavif or ....ftypavis
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return 'image/avif';
    }
  }
  return null;
}

export function sanitizeFilename(name) {
  return String(name || 'vehicle-photo.webp')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

/**
 * Serverless-safe photo upload:
 * - Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is configured.
 * - Falls back to MongoDB Media collection (served via /api/media/:id with immutable caching).
 */
export async function saveUploadedImage({ buffer, originalname, mimetype }) {
  const detectedMime = detectImageMimeFromBuffer(buffer);
  const resolvedMime = detectedMime || mimetype;

  if (!detectedMime || !ALLOWED_MIME_TYPES.has(resolvedMime)) {
    const err = new Error(
      'Invalid image file. Only JPEG, PNG, WebP, and AVIF images are supported.'
    );
    err.status = 400;
    throw err;
  }

  const cleanName = sanitizeFilename(originalname);

  if (env.blobToken) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`vehicles/${Date.now()}-${cleanName}`, buffer, {
      access: 'public',
      contentType: resolvedMime,
      token: env.blobToken,
      addRandomSuffix: true,
    });
    return {
      url: blob.url,
      storageProvider: 'vercel-blob',
      mediaId: '',
    };
  }

  const mediaDoc = await Media.create({
    filename: cleanName,
    mimeType: resolvedMime,
    size: buffer.length,
    data: buffer,
  });

  return {
    url: `/api/media/${mediaDoc._id}`,
    storageProvider: 'mongodb',
    mediaId: String(mediaDoc._id),
  };
}

export async function deleteStoredImage(photo) {
  if (!photo) return;
  try {
    if (photo.storageProvider === 'mongodb' && photo.mediaId) {
      await Media.findByIdAndDelete(photo.mediaId);
    } else if (
      photo.storageProvider === 'vercel-blob' &&
      photo.url &&
      env.blobToken
    ) {
      const { del } = await import('@vercel/blob');
      await del(photo.url, { token: env.blobToken });
    }
  } catch (error) {
    console.warn('[Storage] Non-fatal error cleaning up photo:', error.message);
  }
}
