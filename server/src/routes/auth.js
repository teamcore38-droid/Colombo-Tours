import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  requireAdmin,
  revokeAuthToken,
  serializeAdmin,
  setAuthCookie,
  signAdminToken,
} from '../middleware/auth.js';
import {
  clearRateLimit,
  consumeRateLimit,
  createMongoRateLimiter,
  getClientIp,
  hashRateLimitIdentifier,
  peekRateLimit,
} from '../middleware/rateLimit.js';
import { AdminUser } from '../models/AdminUser.js';
import {
  hashPassword,
  isPasswordWithinByteLimit,
  runDummyPasswordCheck,
  validateNewPassword,
  verifyPassword,
} from '../utils/password.js';

const router = Router();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_LIMIT = env.isTest ? 1000 : 15;
const LOGIN_ACCOUNT_FAIL_LIMIT = 5;
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const CHANGE_PASSWORD_LIMIT = env.isTest ? 200 : 5;

function emailFailureKey(email) {
  return `login-fail-email:${hashRateLimitIdentifier(email)}`;
}

function logSecurityEvent(event, meta = {}) {
  if (env.isTest) return;
  console.info(
    '[Security Audit]',
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...meta,
    })
  );
}

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return next();
});

// Fast in-memory burst shield on warm instances (0 DB cost when triggered)
const loginBurstLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: env.isTest ? 1000 : 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
  },
});

// Distributed MongoDB rate limiter (shared across Vercel Serverless instances & cold starts)
const loginDistributedIpLimiter = createMongoRateLimiter({
  prefix: 'login',
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_IP_LIMIT,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});

const changePasswordLimiter = createMongoRateLimiter({
  prefix: 'change-password',
  windowMs: CHANGE_PASSWORD_WINDOW_MS,
  limit: CHANGE_PASSWORD_LIMIT,
  message:
    'Too many password change attempts. Please wait 15 minutes and try again.',
  keyGenerator: (req) =>
    `change-pwd:${String(req.admin?._id || 'anon')}:${hashRateLimitIdentifier(getClientIp(req))}`,
});

router.post(
  '/login',
  loginBurstLimiter,
  loginDistributedIpLimiter,
  async (req, res, next) => {
    try {
      const rawEmail = req.body?.email;
      const rawPassword = req.body?.password;

      if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
        return res
          .status(400)
          .json({ error: 'Email and password are required.' });
      }

      const email = rawEmail.trim().toLowerCase();
      const password = rawPassword;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: 'Email and password are required.' });
      }

      if (email.length > 160 || !isPasswordWithinByteLimit(password)) {
        await runDummyPasswordCheck('invalid-length');
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const failKey = emailFailureKey(email);
      const emailLock = await peekRateLimit(failKey, LOGIN_ACCOUNT_FAIL_LIMIT);
      if (emailLock.blocked) {
        res.set('Retry-After', String(emailLock.retryAfterSec));
        logSecurityEvent('login_blocked_lockout', {
          emailHash: hashRateLimitIdentifier(email),
          ip: getClientIp(req),
        });
        return res.status(429).json({
          error:
            'Too many failed sign-in attempts. Please wait 15 minutes and try again.',
        });
      }

      const admin = await AdminUser.findOne({ email });

      // Check account-level lock as defense-in-depth
      if (
        admin?.lockUntil &&
        new Date(admin.lockUntil).getTime() > Date.now()
      ) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((new Date(admin.lockUntil).getTime() - Date.now()) / 1000)
        );
        res.set('Retry-After', String(retryAfterSec));
        logSecurityEvent('login_blocked_account_lock', {
          adminId: String(admin._id),
          ip: getClientIp(req),
        });
        return res.status(429).json({
          error:
            'Too many failed sign-in attempts. Please wait 15 minutes and try again.',
        });
      }

      if (!admin || admin.isActive === false || admin.role !== 'admin') {
        // Constant-time bcrypt check prevents timing-based email enumeration
        await runDummyPasswordCheck(password);
        const failResult = await consumeRateLimit(
          failKey,
          LOGIN_WINDOW_MS,
          LOGIN_ACCOUNT_FAIL_LIMIT
        );
        logSecurityEvent('login_failed', {
          reason: admin ? 'inactive_or_role' : 'unknown_email',
          emailHash: hashRateLimitIdentifier(email),
          ip: getClientIp(req),
        });
        if (!failResult.allowed) {
          res.set('Retry-After', String(failResult.retryAfterSec));
          return res.status(429).json({
            error:
              'Too many failed sign-in attempts. Please wait 15 minutes and try again.',
          });
        }
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const valid = await verifyPassword(password, admin.passwordHash);
      if (!valid) {
        const failResult = await consumeRateLimit(
          failKey,
          LOGIN_WINDOW_MS,
          LOGIN_ACCOUNT_FAIL_LIMIT
        );
        const nextAttempts = Number(admin.failedLoginAttempts || 0) + 1;
        const shouldLock = nextAttempts >= LOGIN_ACCOUNT_FAIL_LIMIT;
        await AdminUser.updateOne(
          { _id: admin._id },
          {
            $set: {
              failedLoginAttempts: nextAttempts,
              lockUntil: shouldLock
                ? new Date(Date.now() + LOGIN_WINDOW_MS)
                : null,
            },
          }
        );

        logSecurityEvent('login_failed', {
          reason: 'invalid_password',
          adminId: String(admin._id),
          attempts: nextAttempts,
          locked: shouldLock,
          ip: getClientIp(req),
        });

        if (shouldLock || !failResult.allowed) {
          res.set('Retry-After', String(failResult.retryAfterSec || 900));
          return res.status(429).json({
            error:
              'Too many failed sign-in attempts. Please wait 15 minutes and try again.',
          });
        }
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Successful login: clear lockouts & record audit timestamp
      const now = new Date();
      await Promise.all([
        clearRateLimit(failKey),
        AdminUser.updateOne(
          { _id: admin._id },
          {
            $set: {
              failedLoginAttempts: 0,
              lockUntil: null,
              lastLoginAt: now,
            },
          }
        ),
      ]);
      admin.lastLoginAt = now;

      const token = signAdminToken(admin);
      setAuthCookie(res, token);

      logSecurityEvent('login_success', {
        adminId: String(admin._id),
        ip: getClientIp(req),
      });

      return res.json({
        admin: serializeAdmin(admin),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (token) {
    await revokeAuthToken(token);
  }
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.post('/logout-all', requireAdmin, async (req, res, next) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    await Promise.all([
      AdminUser.updateOne(
        { _id: req.admin._id },
        { $inc: { tokenVersion: 1 } }
      ),
      token ? revokeAuthToken(token) : Promise.resolve(),
    ]);
    clearAuthCookie(res);
    logSecurityEvent('logout_all_sessions', {
      adminId: String(req.admin._id),
      ip: getClientIp(req),
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/change-password',
  requireAdmin,
  changePasswordLimiter,
  async (req, res, next) => {
    try {
      const currentPassword =
        typeof req.body?.currentPassword === 'string'
          ? req.body.currentPassword
          : '';
      const newPassword =
        typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword = req.body?.confirmPassword;

      if (!currentPassword) {
        return res
          .status(400)
          .json({ error: 'Current password is required.' });
      }

      if (!isPasswordWithinByteLimit(currentPassword)) {
        return res.status(401).json({
          error: 'Current password is incorrect.',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      if (
        confirmPassword !== undefined &&
        (typeof confirmPassword !== 'string' || confirmPassword !== newPassword)
      ) {
        return res
          .status(400)
          .json({ error: 'New password and confirmation do not match.' });
      }

      const admin = await AdminUser.findById(req.admin._id);
      if (!admin || admin.isActive === false || admin.role !== 'admin') {
        clearAuthCookie(res);
        return res.status(401).json({ error: 'Session is no longer valid.' });
      }

      const policyCheck = validateNewPassword(newPassword, {
        email: admin.email,
        currentPassword,
      });
      if (!policyCheck.valid) {
        return res.status(400).json({ error: policyCheck.error });
      }

      const currentValid = await verifyPassword(
        currentPassword,
        admin.passwordHash
      );
      if (!currentValid) {
        logSecurityEvent('password_change_failed', {
          adminId: String(admin._id),
          reason: 'incorrect_current_password',
          ip: getClientIp(req),
        });
        return res.status(401).json({
          error: 'Current password is incorrect.',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      const now = new Date();
      admin.passwordHash = await hashPassword(newPassword);
      admin.tokenVersion = Number(admin.tokenVersion || 0) + 1;
      admin.passwordChangedAt = now;
      admin.failedLoginAttempts = 0;
      admin.lockUntil = null;
      await admin.save();

      // Clear any residual failed-login bucket and rotate the active cookie to the new tokenVersion
      await clearRateLimit(emailFailureKey(admin.email));
      const nextToken = signAdminToken(admin);
      setAuthCookie(res, nextToken);

      logSecurityEvent('password_changed', {
        adminId: String(admin._id),
        ip: getClientIp(req),
      });

      return res.json({
        ok: true,
        message: 'Password updated. All other sessions have been signed out.',
        admin: serializeAdmin(admin),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/me', requireAdmin, (req, res) => {
  return res.json({
    admin: serializeAdmin(req.admin),
  });
});

export default router;
