import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
      immutable: true,
    },
    companyName: {
      type: String,
      default: 'Colombo Tours',
      trim: true,
      maxlength: 100,
    },
    tagline: {
      type: String,
      default: 'Built Trust in Excellence',
      trim: true,
      maxlength: 140,
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true,
      maxlength: 20,
    },
    whatsappLink: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    whatsappMode: {
      type: String,
      enum: ['number', 'link'],
      default: 'number',
    },
    whatsappEnabled: {
      type: Boolean,
      default: true,
    },
    telegramHandle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 40,
    },
    telegramLink: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    telegramMode: {
      type: String,
      enum: ['handle', 'link'],
      default: 'handle',
    },
    telegramEnabled: {
      type: Boolean,
      default: true,
    },
    wechatId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 40,
    },
    wechatLink: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    wechatMode: {
      type: String,
      enum: ['id', 'link'],
      default: 'id',
    },
    wechatEnabled: {
      type: Boolean,
      default: true,
    },
    wechatQrUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    wechatQrStorageProvider: {
      type: String,
      enum: ['', 'static', 'cloudinary', 'vercel-blob', 'mongodb', 'external'],
      default: '',
    },
    wechatQrMediaId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    heroHeadline: {
      type: String,
      default: 'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
      trim: true,
      maxlength: 140,
    },
    heroSubheadline: {
      type: String,
      default:
        'Chauffeur-driven flagship sedans, luxury SUVs, and bespoke transfers across Sri Lanka.',
      trim: true,
      maxlength: 260,
    },
    supportGreeting: {
      type: String,
      default:
        'Hello Colombo Tours, I’d like to enquire about renting a vehicle. Could you assist me?',
      trim: true,
      maxlength: 400,
    },
  },
  { timestamps: true }
);

export const SiteSettings =
  mongoose.models.SiteSettings ||
  mongoose.model('SiteSettings', siteSettingsSchema);
