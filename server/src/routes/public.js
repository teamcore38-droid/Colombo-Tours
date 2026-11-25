import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { hasValidAdminToken } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Service } from '../models/Service.js';
import { SiteSettings } from '../models/SiteSettings.js';
import { Vehicle } from '../models/Vehicle.js';
import {
  formatTelegramDisplay,
  formatWhatsAppDisplay,
  isValidTelegramHandle,
  isValidWeChatId,
  isValidWhatsAppNumber,
  normalizeTelegramHandle,
  normalizeWeChatId,
  normalizeWhatsAppNumber,
  sanitizeSafeImageUrl,
  sanitizeTelegramLink,
  sanitizeWeChatLink,
  sanitizeWhatsAppLink,
} from '../utils/channels.js';

const router = Router();

const MAX_PUBLIC_VEHICLES = 200;
const MAX_PUBLIC_CATEGORIES = 100;
const MAX_PUBLIC_SERVICES = 100;

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 10000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many requests right now. Please wait a moment and try again.',
  },
});

router.use(publicApiLimiter);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cache public read endpoints at Vercel's Edge PoP for 60s and serve stale for up to 10m
 * while revalidating in the background.
 * Only honor ?fresh=1 cache bypass when the request carries a valid staff admin JWT
 * so public callers or bots cannot bypass the Edge CDN and hammer MongoDB.
 */
function setPublicEdgeCache(req, res) {
  if (req.query?.fresh === '1' && hasValidAdminToken(req)) {
    res.set('Cache-Control', 'no-store, private');
    res.set('CDN-Cache-Control', 'no-store');
    return;
  }
  res.set('Cache-Control', 'public, max-age=0, must-revalidate');
  res.set(
    'CDN-Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=600'
  );
}

export function serializeSettings(doc) {
  const digits = normalizeWhatsAppNumber(doc?.whatsappNumber || '');
  const whatsappNumberValid = isValidWhatsAppNumber(digits);
  const whatsappLink = sanitizeWhatsAppLink(doc?.whatsappLink || '');
  const whatsappMode = doc?.whatsappMode === 'link' ? 'link' : 'number';
  const whatsappEnabled = doc?.whatsappEnabled !== false;
  const whatsappConfigured =
    whatsappEnabled &&
    (whatsappMode === 'link' ? Boolean(whatsappLink) : whatsappNumberValid);

  const telegramHandle = normalizeTelegramHandle(doc?.telegramHandle || '');
  const telegramHandleValid = isValidTelegramHandle(telegramHandle);
  const telegramLink = sanitizeTelegramLink(doc?.telegramLink || '');
  const telegramMode = doc?.telegramMode === 'link' ? 'link' : 'handle';
  const telegramEnabled = doc?.telegramEnabled !== false;
  const telegramConfigured =
    telegramEnabled &&
    (telegramMode === 'link' ? Boolean(telegramLink) : telegramHandleValid);

  const wechatId = normalizeWeChatId(doc?.wechatId || '');
  const wechatIdValid = isValidWeChatId(wechatId);
  const wechatLink = sanitizeWeChatLink(doc?.wechatLink || '');
  const wechatQrUrl = sanitizeSafeImageUrl(doc?.wechatQrUrl || '');
  const wechatMode = doc?.wechatMode === 'link' ? 'link' : 'id';
  const wechatEnabled = doc?.wechatEnabled !== false;
  const wechatConfigured =
    wechatEnabled &&
    (wechatMode === 'link'
      ? Boolean(wechatLink)
      : wechatIdValid || Boolean(wechatQrUrl));

  return {
    companyName: doc?.companyName || 'Colombo Tours',
    tagline: doc?.tagline || 'Built Trust in Excellence',
    whatsappNumber: whatsappNumberValid ? digits : '',
    whatsappDisplay: whatsappNumberValid ? formatWhatsAppDisplay(digits) : '',
    whatsappLink,
    whatsappMode,
    whatsappEnabled,
    whatsappConfigured,
    telegramHandle: telegramHandleValid ? telegramHandle : '',
    telegramDisplay: telegramHandleValid
      ? formatTelegramDisplay(telegramHandle)
      : '',
    telegramLink,
    telegramMode,
    telegramEnabled,
    telegramConfigured,
    wechatId: wechatIdValid ? wechatId : '',
    wechatDisplay: wechatIdValid ? wechatId : '',
    wechatLink,
    wechatMode,
    wechatEnabled,
    wechatQrUrl,
    wechatQrStorageProvider: wechatQrUrl ? doc?.wechatQrStorageProvider || '' : '',
    wechatQrMediaId: wechatQrUrl ? doc?.wechatQrMediaId || '' : '',
    wechatConfigured,
    anyBookingChannelConfigured:
      whatsappConfigured || telegramConfigured || wechatConfigured,
    heroHeadline:
      doc?.heroHeadline || 'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
    heroSubheadline:
      doc?.heroSubheadline ||
      'Chauffeur-driven flagship sedans, luxury SUVs, and bespoke transfers across Sri Lanka.',
    supportGreeting:
      doc?.supportGreeting ||
      'Hello Colombo Tours, I’d like to enquire about renting a vehicle. Could you assist me?',
    updatedAt: doc?.updatedAt || null,
  };
}

/**
 * Single fast bootstrap endpoint to avoid client request waterfalls on mobile networks.
 */
router.get('/bootstrap', async (req, res, next) => {
  try {
    const [settingsDoc, categories, services, vehicles] = await Promise.all([
      SiteSettings.findOne({ key: 'global' }).lean(),
      Category.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .limit(MAX_PUBLIC_CATEGORIES)
        .lean(),
      Service.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .limit(MAX_PUBLIC_SERVICES)
        .lean(),
      Vehicle.find({ isPublished: true })
        .populate('categories', 'name slug sortOrder isActive')
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(MAX_PUBLIC_VEHICLES)
        .lean(),
    ]);

    setPublicEdgeCache(req, res);
    return res.json({
      settings: serializeSettings(settingsDoc),
      categories,
      services,
      vehicles,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const settingsDoc = await SiteSettings.findOne({ key: 'global' }).lean();
    setPublicEdgeCache(req, res);
    return res.json({ settings: serializeSettings(settingsDoc) });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .limit(MAX_PUBLIC_CATEGORIES)
      .lean();
    setPublicEdgeCache(req, res);
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .limit(MAX_PUBLIC_SERVICES)
      .lean();
    setPublicEdgeCache(req, res);
    return res.json({ services });
  } catch (error) {
    return next(error);
  }
});

router.get('/vehicles', async (req, res, next) => {
  try {
    const {
      search = '',
      category = '',
      transmission = '',
      chauffeur = '',
      minSeats = '',
      featured = '',
    } = req.query;

    const filter = { isPublished: true };

    const trimmedSearch = String(search).trim().slice(0, 80);
    if (trimmedSearch) {
      const rx = new RegExp(escapeRegex(trimmedSearch), 'i');
      filter.$or = [
        { name: rx },
        { model: rx },
        { summary: rx },
        { description: rx },
      ];
    }

    const trimmedCategory = String(category).trim().toLowerCase();
    if (trimmedCategory && trimmedCategory !== 'all') {
      let categoryId = null;
      if (mongoose.isValidObjectId(trimmedCategory)) {
        categoryId = trimmedCategory;
      } else {
        const catDoc = await Category.findOne({
          slug: trimmedCategory,
          isActive: true,
        })
          .select('_id')
          .lean();
        if (!catDoc) {
          return res.json({ vehicles: [] });
        }
        categoryId = catDoc._id;
      }
      filter.categories = categoryId;
    }

    const trimmedTransmission = String(transmission).trim();
    if (trimmedTransmission && trimmedTransmission.toLowerCase() !== 'all') {
      filter['specs.transmission'] = new RegExp(
        `^${escapeRegex(trimmedTransmission)}$`,
        'i'
      );
    }

    const trimmedChauffeur = String(chauffeur).trim();
    if (trimmedChauffeur && trimmedChauffeur.toLowerCase() !== 'all') {
      filter['specs.chauffeur'] = new RegExp(
        escapeRegex(trimmedChauffeur),
        'i'
      );
    }

    const parsedSeats = Number(minSeats);
    if (Number.isFinite(parsedSeats) && parsedSeats > 0) {
      filter['specs.seats'] = { $gte: parsedSeats };
    }

    if (featured === 'true') {
      filter.isFeatured = true;
    }

    const vehicles = await Vehicle.find(filter)
      .populate('categories', 'name slug sortOrder isActive')
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(MAX_PUBLIC_VEHICLES)
      .lean();

    setPublicEdgeCache(req, res);
    return res.json({ vehicles });
  } catch (error) {
    return next(error);
  }
});

router.get('/vehicles/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const query = mongoose.isValidObjectId(idOrSlug)
      ? { _id: idOrSlug, isPublished: true }
      : { slug: String(idOrSlug).toLowerCase(), isPublished: true };

    const vehicle = await Vehicle.findOne(query)
      .populate('categories', 'name slug sortOrder isActive')
      .lean();

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    setPublicEdgeCache(req, res);
    return res.json({ vehicle });
  } catch (error) {
    return next(error);
  }
});

export default router;
