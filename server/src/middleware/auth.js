import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AdminUser } from '../models/AdminUser.js';

export const AUTH_COOKIE_NAME = 'ct_admin_token';

export function signAdminToken(admin) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(
    {
      sub: String(admin._id),
      email: admin.email,
      role: admin.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Lightweight, zero-DB verification of whether a request carries a valid staff JWT.
 * Used to restrict ?fresh=1 CDN cache bypasses to authenticated staff only.
 */
export function hasValidAdminToken(req) {
  try {
    let token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }
    if (!token || !env.jwtSecret) return false;
    const decoded = jwt.verify(token, env.jwtSecret);
    return Boolean(decoded?.sub && decoded?.role === 'admin');
  } catch {
    return false;
  }
}

export async function requireAdmin(req, res, next) {
  try {
    let token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const admin = await AdminUser.findById(decoded.sub).select(
      '_id email name role'
    );

    if (!admin) {
      return res.status(401).json({ error: 'Session is no longer valid.' });
    }

    req.admin = admin;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin session.' });
  }
}
