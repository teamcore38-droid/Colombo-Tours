import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import mediaRoutes from './routes/media.js';
import publicRoutes from './routes/public.js';
import { createShareRouter } from './routes/share.js';
import { ensureBootstrapped } from './utils/seed.js';

export function createApp({ skipDbMiddleware = false } = {}) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowedOrigins = new Set([
    ...env.corsOrigins,
    ...[
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .filter(Boolean)
      .map((host) => `https://${host.replace(/^https?:\/\//i, '')}`),
  ]);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'colombo-tours-api' });
  });

  // Ensure MongoDB connection & base setup before hitting database routes
  if (!skipDbMiddleware) {
    app.use('/api', async (_req, _res, next) => {
      try {
        await connectDB();
        await ensureBootstrapped();
        return next();
      } catch (error) {
        return next(error);
      }
    });
  }

  app.use('/v', createShareRouter({ skipDbMiddleware }));

  app.use('/api/auth', authRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Centralized error handler (including multer upload limits)
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(400)
          .json({ error: 'Image is too large. Maximum allowed size is 4 MB.' });
      }
      return res.status(400).json({ error: err.message });
    }

    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
      console.error('[API Error]', err);
    }

    return res.status(status).json({
      error:
        status >= 500 && env.isProduction
          ? 'An unexpected server error occurred.'
          : err.message || 'Request failed.',
    });
  });

  return app;
}

export const app = createApp();
export default app;
