import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AuthRateLimit } from '../models/AuthRateLimit.js';

export function hashRateLimitIdentifier(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

export function getClientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(raw).trim().slice(0, 80);
}

/**
 * Atomic single-round-trip MongoDB rate-limit counter safe across Vercel serverless
 * cold starts and concurrent instances. Resets expired windows atomically even before
 * MongoDB's background TTL monitor sweeps expired documents.
 */
export async function consumeRateLimit(key, windowMs, limit) {
  if (mongoose.connection.readyState !== 1) {
    return { allowed: true, count: 1, remaining: Math.max(0, limit - 1), retryAfterSec: 0 };
  }

  const now = new Date();
  const nextExpiry = new Date(now.getTime() + windowMs);

  const runUpdate = () =>
    AuthRateLimit.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            count: {
              $cond: [
                { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, now] },
                1,
                { $add: [{ $ifNull: ['$count', 0] }, 1] },
              ],
            },
            expiresAt: {
              $cond: [
                { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, now] },
                nextExpiry,
                '$expiresAt',
              ],
            },
          },
        },
      ],
      { upsert: true, new: true }
    ).lean();

  let doc;
  try {
    doc = await runUpdate();
  } catch (err) {
    // Handle concurrent first-upsert duplicate key race cleanly
    if (err?.code === 11000) {
      doc = await runUpdate();
    } else {
      throw err;
    }
  }

  const count = Number(doc?.count || 1);
  const expiresAtMs = doc?.expiresAt ? new Date(doc.expiresAt).getTime() : nextExpiry.getTime();
  const retryAfterSec = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterSec,
  };
}

/**
 * Checks whether a rate-limit bucket is already exhausted without incrementing it.
 */
export async function peekRateLimit(key, limit) {
  if (mongoose.connection.readyState !== 1) {
    return { blocked: false, count: 0, retryAfterSec: 0 };
  }

  const doc = await AuthRateLimit.findOne({ key }).lean();
  if (!doc || !doc.expiresAt) {
    return { blocked: false, count: 0, retryAfterSec: 0 };
  }

  const expiresAtMs = new Date(doc.expiresAt).getTime();
  const nowMs = Date.now();
  if (expiresAtMs <= nowMs) {
    return { blocked: false, count: 0, retryAfterSec: 0 };
  }

  const count = Number(doc.count || 0);
  return {
    blocked: count >= limit,
    count,
    retryAfterSec: Math.max(1, Math.ceil((expiresAtMs - nowMs) / 1000)),
  };
}

export async function clearRateLimit(key) {
  if (mongoose.connection.readyState !== 1) return;
  await AuthRateLimit.deleteOne({ key }).catch(() => {});
}

/**
 * Express middleware enforcing a MongoDB-backed distributed rate limit.
 */
export function createMongoRateLimiter({
  prefix,
  windowMs,
  limit,
  message = 'Too many requests. Please wait and try again.',
  keyGenerator = (req) => `${prefix}:ip:${hashRateLimitIdentifier(getClientIp(req))}`,
}) {
  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      const result = await consumeRateLimit(key, windowMs, limit);
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(result.remaining));
      res.set('RateLimit-Reset', String(result.retryAfterSec));

      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterSec));
        return res.status(429).json({ error: message });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
