import multer from 'multer';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

/**
 * Memory storage keeps uploads 100% compatible with Vercel serverless functions
 * (no writes to read-only ephemeral filesystem).
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4 MB max (fits comfortably under Vercel 4.5 MB limit)
    files: 6,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error(
        'Unsupported file type. Please upload JPEG, PNG, WebP, or AVIF images.'
      );
      err.status = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});
