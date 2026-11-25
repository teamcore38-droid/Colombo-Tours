import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import {
  clearAuthCookie,
  requireAdmin,
  setAuthCookie,
  signAdminToken,
} from '../middleware/auth.js';
import { AdminUser } from '../models/AdminUser.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
  },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required.' });
    }

    const admin = await AdminUser.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signAdminToken(admin);
    setAuthCookie(res, token);

    return res.json({
      admin: {
        id: String(admin._id),
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  return res.json({
    admin: {
      id: String(req.admin._id),
      email: req.admin.email,
      name: req.admin.name,
      role: req.admin.role,
    },
  });
});

export default router;
