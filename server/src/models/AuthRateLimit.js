import mongoose from 'mongoose';

const authRateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      maxlength: 180,
    },
    count: {
      type: Number,
      required: true,
      default: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false }
);

// MongoDB TTL index automatically purges expired rate-limit windows
authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthRateLimit =
  mongoose.models.AuthRateLimit ||
  mongoose.model('AuthRateLimit', authRateLimitSchema);
