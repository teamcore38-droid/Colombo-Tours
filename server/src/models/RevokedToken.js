import mongoose from 'mongoose';

const revokedTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
      maxlength: 120,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false }
);

// Auto-expire revoked token records once the original JWT naturally expires
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedToken =
  mongoose.models.RevokedToken ||
  mongoose.model('RevokedToken', revokedTokenSchema);
