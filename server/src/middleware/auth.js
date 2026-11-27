import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AdminUser } from '../models/AdminUser.js';
import { RevokedToken } from '../models/RevokedToken.js';

export const AUTH_COOKIE_NAME = 'ct_admin_token';
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'colombo-tours-api';
export const JWT_AUDIENCE = 'colombo-tours-admin';

const DEFAULT_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d ceiling

export function parseJwtExpiryMs(rawExpiry) {
  if (typeof rawExpiry === 'number' && Number.isFinite(rawExpiry) && rawExpiry > 0) {
    return Math.min(rawExpiry * 1000, MAX_COOKIE_MAX_AGE_MS);
  }
  const str = String(rawExpiry || '').trim();
  const match = str.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return DEFAULT_COOKIE_MAX_AGE_MS;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const ms = amount * (multipliers[unit] || 0);
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_COOKIE_MAX_AGE_MS;
  return Math.min(ms, MAX_COOKIE_MAX_AGE_MS);
}

export function serializeAdmin(admin) {
  if (!admin) return null;
  return {
    id: String(admin._id),
    email: admin.email,
    name: admin.name,
    role: admin.role,
    passwordChangedAt: admin.passwordChangedAt || null,
    lastLoginAt: admin.lastLoginAt || null,
  };
}

export function signAdminToken(admin) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(
    {
      sub: String(admin._id),
      email: admin.email,
      role: admin.role,
      tv: Number(admin.tokenVersion || 0),
    },
    env.jwtSecret,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: env.jwtExpiresIn,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: crypto.randomUUID(),
    }
  );
}

export function verifyAdminToken(token) {
  if (!token || !env.jwtSecret) return null;
  const decoded = jwt.verify(token, env.jwtSecret, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    typeof decoded.sub !== 'string' ||
    !decoded.sub ||
    decoded.role !== 'admin' ||
    typeof decoded.jti !== 'string' ||
    !decoded.jti ||
    typeof decoded.tv !== 'number'
  ) {
    return null;
  }
  return decoded;
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    maxAge: parseJwtExpiryMs(env.jwtExpiresIn),
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Revokes a single JWT by its jti until its natural expiration (MongoDB TTL auto-cleans).
 */
export async function revokeAuthToken(token) {
  if (!token || mongoose.connection.readyState !== 1) return false;
  try {
    const decoded = verifyAdminToken(token);
    if (!decoded?.jti || !decoded?.exp) return false;
    const expiresAt = new Date(decoded.exp * 1000);
    if (expiresAt.getTime() <= Date.now()) return true;

    await RevokedToken.updateOne(
      { jti: decoded.jti },
      { $setOnInsert: { jti: decoded.jti, expiresAt } },
      { upsert: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Lightweight, zero-DB verification of whether a request carries a structurally valid staff JWT cookie.
 * Used only to restrict ?fresh=1 CDN cache bypasses on public endpoints to authenticated staff.
 */
export function hasValidAdminToken(req) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) return false;
    return Boolean(verifyAdminToken(token));
  } catch {
    return false;
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const decoded = verifyAdminToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired admin session.' });
    }

    // Parallel indexed lookups (lean AdminUser + RevokedToken check) keep auth latency minimal
    const [admin, revoked] = await Promise.all([
      AdminUser.findById(decoded.sub)
        .select('_id email name role isActive tokenVersion passwordChangedAt lastLoginAt')
        .lean(),
      RevokedToken.exists({ jti: decoded.jti }),
    ]);

    if (
      !admin ||
      admin.isActive === false ||
      admin.role !== 'admin' ||
      Number(admin.tokenVersion || 0) !== decoded.tv ||
      revoked
    ) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session is no longer valid.' });
    }

    req.admin = admin;
    req.authToken = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin session.' });
  }
}
