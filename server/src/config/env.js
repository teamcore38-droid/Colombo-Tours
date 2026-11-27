import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWeakOrPlaceholderSecret } from '../utils/password.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config();

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const defaultCorsOrigins = isProduction
  ? ''
  : 'http://localhost:5173,http://127.0.0.1:5173';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test' || process.env.VITEST === 'true',
  port: Number(process.env.PORT || 5000),
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  useInMemoryDb: !isProduction && process.env.USE_IN_MEMORY_DB === 'true',
  jwtSecret:
    (process.env.JWT_SECRET || '').trim() ||
    (isProduction ? '' : 'colombo-tours-local-dev-secret-change-me'),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '24h').trim(),
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@colombotours.lk')
    .trim()
    .toLowerCase(),
  adminPassword:
    process.env.ADMIN_PASSWORD || (isProduction ? '' : 'ChangeMe123!'),
  adminName: (process.env.ADMIN_NAME || 'Colombo Tours Staff').trim(),
  defaultWhatsappNumber: (process.env.DEFAULT_WHATSAPP_NUMBER || '').trim(),
  defaultTelegramHandle: (process.env.DEFAULT_TELEGRAM_HANDLE || '').trim(),
  defaultWeChatId: (process.env.DEFAULT_WECHAT_ID || '').trim(),
  seedOnEmpty: process.env.SEED_ON_EMPTY !== 'false',
  cloudinaryUrl: (process.env.CLOUDINARY_URL || '').trim(),
  cloudinaryCloudName: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  cloudinaryApiKey: (process.env.CLOUDINARY_API_KEY || '').trim(),
  cloudinaryApiSecret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  cloudinaryFolder: (
    process.env.CLOUDINARY_FOLDER || 'colombo-tours/vehicles'
  ).trim(),
  blobToken: (process.env.BLOB_READ_WRITE_TOKEN || '').trim(),
  corsOrigins: (process.env.CORS_ORIGINS ?? defaultCorsOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export function validateCriticalEnv(targetEnv = env) {
  if (!targetEnv.isProduction) return;

  if (!targetEnv.jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required in production.');
  }
  if (isWeakOrPlaceholderSecret(targetEnv.jwtSecret)) {
    throw new Error(
      'JWT_SECRET is too weak or still uses a placeholder value. Generate a strong random secret (at least 32 characters).'
    );
  }
  if (!targetEnv.mongodbUri) {
    throw new Error('MONGODB_URI environment variable is required in production.');
  }
}

export function assertCriticalEnv() {
  validateCriticalEnv(env);
}
