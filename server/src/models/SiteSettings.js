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
