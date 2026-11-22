import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    badge: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 400,
    },
    icon: {
      type: String,
      enum: ['plane', 'heart', 'compass', 'briefcase', 'car'],
      default: 'car',
    },
    whatsappLabel: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

serviceSchema.index({ isActive: 1, sortOrder: 1 });

export const Service =
  mongoose.models.Service || mongoose.model('Service', serviceSchema);
