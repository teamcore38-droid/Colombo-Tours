import mongoose from 'mongoose';

/**
 * Serverless-safe MongoDB image storage used automatically when
 * BLOB_READ_WRITE_TOKEN (Vercel Blob) is not configured.
 * Images are client-compressed to lightweight WebP/JPEG before upload
 * and served from /api/media/:id with long-lived immutable cache headers.
 */
const mediaSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    },
    size: {
      type: Number,
      required: true,
      max: 4 * 1024 * 1024, // 4 MB safety ceiling
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  { timestamps: true }
);

export const Media =
  mongoose.models.Media || mongoose.model('Media', mediaSchema);
