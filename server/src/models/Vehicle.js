import mongoose from 'mongoose';

const vehiclePhotoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    alt: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    storageProvider: {
      type: String,
      enum: ['static', 'cloudinary', 'vercel-blob', 'mongodb', 'external'],
      default: 'external',
    },
    mediaId: {
      type: String,
      default: '',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const vehicleSpecsSchema = new mongoose.Schema(
  {
    seats: {
      type: Number,
      min: 1,
      max: 60,
      default: null,
    },
    transmission: {
      type: String,
      default: '',
      trim: true,
      maxlength: 40,
    },
    luggage: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    chauffeur: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    fuelType: {
      type: String,
      default: '',
      trim: true,
      maxlength: 40,
    },
    airConditioning: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    model: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 150,
    },
    year: {
      type: Number,
      min: 1950,
      max: 2100,
      default: null,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    summary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 260,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    specs: {
      type: vehicleSpecsSchema,
      default: () => ({}),
    },
    highlights: {
      type: [String],
      default: [],
    },
    photos: {
      type: [vehiclePhotoSchema],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ isPublished: 1, sortOrder: 1, createdAt: -1 });
vehicleSchema.index({ isPublished: 1, isFeatured: 1, sortOrder: 1 });
vehicleSchema.index({ name: 'text', model: 'text', summary: 'text', description: 'text' });

export const Vehicle =
  mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
