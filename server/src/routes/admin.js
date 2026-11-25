import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { requireAdmin } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { Category } from '../models/Category.js';
import { Service } from '../models/Service.js';
import { SiteSettings } from '../models/SiteSettings.js';
import { Vehicle } from '../models/Vehicle.js';
import { generateUniqueSlug } from '../utils/slug.js';
import {
  deleteStoredImage,
  getActiveStorageProvider,
  saveUploadedImage,
} from '../utils/storage.js';
import {
  isValidTelegramHandle,
  isValidTelegramLink,
  isValidWeChatId,
  isValidWeChatLink,
  isValidWhatsAppLink,
  isValidWhatsAppNumber,
  normalizeTelegramHandle,
  normalizeWeChatId,
  normalizeWhatsAppNumber,
  sanitizeSafeImageUrl,
  sanitizeTelegramLink,
  sanitizeWeChatLink,
  sanitizeWhatsAppLink,
} from '../utils/channels.js';
import { serializeSettings } from './public.js';

const router = Router();

// Never cache or index private staff admin API responses
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return next();
});

// All admin routes strictly require authenticated staff
router.use(requireAdmin);

const telegramVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error:
      'Too many Telegram verification checks. Please wait a few minutes and try again.',
  },
});

const STRICT_TELEGRAM_USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/;
const STRICT_TELEGRAM_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

function extractTelegramDisplayName(html) {
  const match = html.match(
    /<div class="tgme_page_title"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (!match) return '';
  return match[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

async function resolveCategoryIds(rawCategories) {
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return [];
  }

  const objectIds = [];
  const slugs = [];

  for (const item of rawCategories) {
    if (!item) continue;
    const val = typeof item === 'object' ? item._id || item.slug : item;
    const str = String(val || '').trim();
    if (!str) continue;
    if (mongoose.isValidObjectId(str)) {
      objectIds.push(str);
    } else {
      slugs.push(str.toLowerCase());
    }
  }

  const found = await Category.find({
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ...(slugs.length ? [{ slug: { $in: slugs } }] : []),
    ],
  })
    .select('_id')
    .lean();

  return found.map((c) => c._id);
}

function sanitizePhotos(rawPhotos) {
  if (!Array.isArray(rawPhotos)) return [];
  const clean = [];
  for (const item of rawPhotos) {
    if (!item) continue;
    const url = String(item.url || '').trim();
    if (!url) continue;
    // Allow relative site/API paths or http(s) URLs only (block javascript: / data: XSS)
    const isSafeUrl =
      url.startsWith('/') ||
      /^https?:\/\/[^\s]+$/i.test(url);
    if (!isSafeUrl) continue;

    clean.push({
      url,
      alt: String(item.alt || '').trim().slice(0, 160),
      storageProvider: [
        'static',
        'cloudinary',
        'vercel-blob',
        'mongodb',
        'external',
      ].includes(item.storageProvider)
        ? item.storageProvider
        : url.startsWith('/api/media/')
          ? 'mongodb'
          : url.startsWith('/vehicles/')
            ? 'static'
            : 'external',
      mediaId: String(item.mediaId || '').trim(),
      isPrimary: Boolean(item.isPrimary),
    });
  }

  if (clean.length > 0 && !clean.some((p) => p.isPrimary)) {
    clean[0].isPrimary = true;
  }
  return clean;
}

function sanitizeSpecs(rawSpecs = {}) {
  const seatsNum =
    rawSpecs.seats === '' ||
    rawSpecs.seats === null ||
    rawSpecs.seats === undefined
      ? null
      : Number(rawSpecs.seats);

  return {
    seats:
      seatsNum !== null && Number.isFinite(seatsNum) && seatsNum >= 1 && seatsNum <= 60
        ? Math.round(seatsNum)
        : null,
    transmission: String(rawSpecs.transmission || '').trim().slice(0, 40),
    luggage: String(rawSpecs.luggage || '').trim().slice(0, 60),
    chauffeur: String(rawSpecs.chauffeur || '').trim().slice(0, 60),
    fuelType: String(rawSpecs.fuelType || '').trim().slice(0, 40),
    airConditioning:
      rawSpecs.airConditioning === undefined
        ? true
        : Boolean(rawSpecs.airConditioning),
  };
}

function sanitizeHighlights(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 12);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n|,/)
      .map((item) => item.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

// --- Single-request fast Admin Dashboard bootstrap ---
router.get('/bootstrap', async (req, res, next) => {
  try {
    const [vehicles, categories, services, settingsDoc] = await Promise.all([
      Vehicle.find()
        .populate('categories', 'name slug sortOrder isActive')
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean(),
      Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
      Service.find().sort({ sortOrder: 1, name: 1 }).lean(),
      SiteSettings.findOne({ key: 'global' }).lean(),
    ]);

    const countMap = new Map();
    for (const vehicle of vehicles) {
      for (const cat of vehicle.categories || []) {
        const key = String(cat?._id || cat);
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    const enrichedCategories = categories.map((cat) => ({
      ...cat,
      vehicleCount: countMap.get(String(cat._id)) || 0,
    }));

    return res.json({
      admin: {
        id: String(req.admin._id),
        email: req.admin.email,
        name: req.admin.name,
        role: req.admin.role,
      },
      vehicles,
      categories: enrichedCategories,
      services,
      settings: serializeSettings(settingsDoc),
    });
  } catch (error) {
    return next(error);
  }
});

// --- Overview ---
router.get('/overview', async (_req, res, next) => {
  try {
    const [
      totalVehicles,
      publishedVehicles,
      featuredVehicles,
      categoriesCount,
      servicesCount,
      settingsDoc,
    ] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ isPublished: true }),
      Vehicle.countDocuments({ isFeatured: true, isPublished: true }),
      Category.countDocuments(),
      Service.countDocuments(),
      SiteSettings.findOne({ key: 'global' }).lean(),
    ]);

    return res.json({
      stats: {
        totalVehicles,
        publishedVehicles,
        unpublishedVehicles: totalVehicles - publishedVehicles,
        featuredVehicles,
        categoriesCount,
        servicesCount,
      },
      settings: serializeSettings(settingsDoc),
    });
  } catch (error) {
    return next(error);
  }
});

// --- Photo Upload ---
router.post(
  '/uploads',
  imageUpload.array('photos', 6),
  async (req, res, next) => {
    try {
      const files = req.files || [];
      if (!files.length) {
        return res
          .status(400)
          .json({ error: 'Please select at least one image file to upload.' });
      }

      const uploaded = await Promise.all(
        files.map(async (file) => {
          const stored = await saveUploadedImage({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          });
          return {
            ...stored,
            alt: file.originalname.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          };
        })
      );

      return res.status(201).json({
        photos: uploaded,
        storageProvider: getActiveStorageProvider(),
      });
    } catch (error) {
      return next(error);
    }
  }
);

// --- Vehicles CRUD ---
router.get('/vehicles', async (req, res, next) => {
  try {
    const { search = '', status = 'all', category = '' } = req.query;
    const filter = {};

    if (status === 'published') filter.isPublished = true;
    if (status === 'unpublished') filter.isPublished = false;

    const trimmedSearch = String(search).trim();
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      filter.$or = [{ name: rx }, { model: rx }, { summary: rx }];
    }

    if (category && category !== 'all') {
      const resolved = await resolveCategoryIds([category]);
      if (resolved.length) {
        filter.categories = resolved[0];
      } else {
        return res.json({ vehicles: [] });
      }
    }

    const vehicles = await Vehicle.find(filter)
      .populate('categories', 'name slug sortOrder isActive')
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return res.json({ vehicles });
  } catch (error) {
    return next(error);
  }
});

router.post('/vehicles', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Vehicle name is required.' });
    }

    const yearRaw = req.body?.year;
    const year =
      yearRaw === '' || yearRaw === null || yearRaw === undefined
        ? null
        : Number(yearRaw);

    if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) {
      return res
        .status(400)
        .json({ error: 'Vehicle year must be between 1950 and 2100.' });
    }

    const [slug, categoryIds] = await Promise.all([
      generateUniqueSlug(Vehicle, name),
      resolveCategoryIds(req.body?.categories),
    ]);

    const vehicle = await Vehicle.create({
      name: name.slice(0, 120),
      model: String(req.body?.model || '').trim().slice(0, 120),
      slug,
      year,
      categories: categoryIds,
      summary: String(req.body?.summary || '').trim().slice(0, 260),
      description: String(req.body?.description || '').trim().slice(0, 2000),
      specs: sanitizeSpecs(req.body?.specs),
      highlights: sanitizeHighlights(req.body?.highlights),
      photos: sanitizePhotos(req.body?.photos),
      isPublished:
        req.body?.isPublished === undefined
          ? true
          : Boolean(req.body.isPublished),
      isFeatured: Boolean(req.body?.isFeatured),
      sortOrder: Number.isFinite(Number(req.body?.sortOrder))
        ? Number(req.body.sortOrder)
        : 0,
    });

    const populated = await Vehicle.findById(vehicle._id)
      .populate('categories', 'name slug sortOrder isActive')
      .lean();

    return res.status(201).json({ vehicle: populated });
  } catch (error) {
    return next(error);
  }
});

router.put('/vehicles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const existing = await Vehicle.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const name = String(req.body?.name ?? existing.name).trim();
    if (!name) {
      return res.status(400).json({ error: 'Vehicle name is required.' });
    }

    const yearRaw = req.body?.year;
    let year = existing.year;
    if (yearRaw !== undefined) {
      year =
        yearRaw === '' || yearRaw === null ? null : Number(yearRaw);
      if (
        year !== null &&
        (!Number.isInteger(year) || year < 1950 || year > 2100)
      ) {
        return res
          .status(400)
          .json({ error: 'Vehicle year must be between 1950 and 2100.' });
      }
    }

    const oldPhotos = existing.photos || [];
    const nextPhotos =
      req.body?.photos !== undefined
        ? sanitizePhotos(req.body.photos)
        : oldPhotos;

    if (name !== existing.name) {
      existing.slug = await generateUniqueSlug(Vehicle, name, existing._id);
    }

    existing.name = name.slice(0, 120);
    if (req.body?.model !== undefined) {
      existing.model = String(req.body.model || '').trim().slice(0, 120);
    }
    existing.year = year;
    if (req.body?.categories !== undefined) {
      existing.categories = await resolveCategoryIds(req.body.categories);
    }
    if (req.body?.summary !== undefined) {
      existing.summary = String(req.body.summary || '').trim().slice(0, 260);
    }
    if (req.body?.description !== undefined) {
      existing.description = String(req.body.description || '')
        .trim()
        .slice(0, 2000);
    }
    if (req.body?.specs !== undefined) {
      existing.specs = sanitizeSpecs(req.body.specs);
    }
    if (req.body?.highlights !== undefined) {
      existing.highlights = sanitizeHighlights(req.body.highlights);
    }
    if (req.body?.photos !== undefined) {
      existing.photos = nextPhotos;
    }
    if (req.body?.isPublished !== undefined) {
      existing.isPublished = Boolean(req.body.isPublished);
    }
    if (req.body?.isFeatured !== undefined) {
      existing.isFeatured = Boolean(req.body.isFeatured);
    }
    if (req.body?.sortOrder !== undefined && Number.isFinite(Number(req.body.sortOrder))) {
      existing.sortOrder = Number(req.body.sortOrder);
    }

    await existing.save();

    // Clean up any removed uploaded images
    if (req.body?.photos !== undefined) {
      const keptUrls = new Set(nextPhotos.map((p) => p.url));
      const removed = oldPhotos.filter((p) => !keptUrls.has(p.url));
      await Promise.all(removed.map((p) => deleteStoredImage(p)));
    }

    const populated = await Vehicle.findById(existing._id)
      .populate('categories', 'name slug sortOrder isActive')
      .lean();

    return res.json({ vehicle: populated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/vehicles/:id/publish', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    vehicle.isPublished =
      typeof req.body?.isPublished === 'boolean'
        ? req.body.isPublished
        : !vehicle.isPublished;
    await vehicle.save();

    const populated = await Vehicle.findById(vehicle._id)
      .populate('categories', 'name slug sortOrder isActive')
      .lean();

    return res.json({ vehicle: populated });
  } catch (error) {
    return next(error);
  }
});

router.patch('/vehicles/:id/featured', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    vehicle.isFeatured =
      typeof req.body?.isFeatured === 'boolean'
        ? req.body.isFeatured
        : !vehicle.isFeatured;
    await vehicle.save();

    const populated = await Vehicle.findById(vehicle._id)
      .populate('categories', 'name slug sortOrder isActive')
      .lean();

    return res.json({ vehicle: populated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/vehicles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const deleted = await Vehicle.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    await Promise.all((deleted.photos || []).map((p) => deleteStoredImage(p)));
    return res.json({ ok: true, id });
  } catch (error) {
    return next(error);
  }
});

// --- Categories CRUD ---
router.get('/categories', async (_req, res, next) => {
  try {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
      Vehicle.aggregate([
        { $unwind: '$categories' },
        { $group: { _id: '$categories', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const enriched = categories.map((cat) => ({
      ...cat,
      vehicleCount: countMap.get(String(cat._id)) || 0,
    }));

    return res.json({ categories: enriched });
  } catch (error) {
    return next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const duplicate = await Category.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (duplicate) {
      return res
        .status(409)
        .json({ error: 'A category with that name already exists.' });
    }

    const slug = await generateUniqueSlug(Category, name);
    const category = await Category.create({
      name: name.slice(0, 60),
      slug,
      description: String(req.body?.description || '').trim().slice(0, 240),
      sortOrder: Number.isFinite(Number(req.body?.sortOrder))
        ? Number(req.body.sortOrder)
        : 0,
      isActive:
        req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
    });

    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Category name is required.' });
      }
      if (name !== category.name) {
        const duplicate = await Category.findOne({
          _id: { $ne: id },
          name: new RegExp(
            `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
        });
        if (duplicate) {
          return res
            .status(409)
            .json({ error: 'A category with that name already exists.' });
        }
        category.name = name.slice(0, 60);
        category.slug = await generateUniqueSlug(Category, name, category._id);
      }
    }

    if (req.body?.description !== undefined) {
      category.description = String(req.body.description || '')
        .trim()
        .slice(0, 240);
    }
    if (
      req.body?.sortOrder !== undefined &&
      Number.isFinite(Number(req.body.sortOrder))
    ) {
      category.sortOrder = Number(req.body.sortOrder);
    }
    if (req.body?.isActive !== undefined) {
      category.isActive = Boolean(req.body.isActive);
    }

    await category.save();
    return res.json({ category });
  } catch (error) {
    return next(error);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    await Vehicle.updateMany(
      { categories: deleted._id },
      { $pull: { categories: deleted._id } }
    );

    return res.json({ ok: true, id });
  } catch (error) {
    return next(error);
  }
});

// --- Services CRUD ---
router.get('/services', async (_req, res, next) => {
  try {
    const services = await Service.find().sort({ sortOrder: 1, name: 1 }).lean();
    return res.json({ services });
  } catch (error) {
    return next(error);
  }
});

router.post('/services', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Service name is required.' });
    }
    const slug = await generateUniqueSlug(Service, name);
    const service = await Service.create({
      name: name.slice(0, 100),
      slug,
      badge: String(req.body?.badge || '').trim().slice(0, 60),
      description: String(req.body?.description || '').trim().slice(0, 400),
      icon: ['plane', 'heart', 'compass', 'briefcase', 'car'].includes(
        req.body?.icon
      )
        ? req.body.icon
        : 'car',
      whatsappLabel: String(req.body?.whatsappLabel || name)
        .trim()
        .slice(0, 120),
      isActive:
        req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
      sortOrder: Number.isFinite(Number(req.body?.sortOrder))
        ? Number(req.body.sortOrder)
        : 0,
    });

    return res.status(201).json({ service });
  } catch (error) {
    return next(error);
  }
});

router.put('/services/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'Service name is required.' });
      }
      if (name !== service.name) {
        service.name = name.slice(0, 100);
        service.slug = await generateUniqueSlug(Service, name, service._id);
      }
    }
    if (req.body?.badge !== undefined) {
      service.badge = String(req.body.badge || '').trim().slice(0, 60);
    }
    if (req.body?.description !== undefined) {
      service.description = String(req.body.description || '')
        .trim()
        .slice(0, 400);
    }
    if (
      req.body?.icon !== undefined &&
      ['plane', 'heart', 'compass', 'briefcase', 'car'].includes(req.body.icon)
    ) {
      service.icon = req.body.icon;
    }
    if (req.body?.whatsappLabel !== undefined) {
      service.whatsappLabel = String(req.body.whatsappLabel || '')
        .trim()
        .slice(0, 120);
    }
    if (req.body?.isActive !== undefined) {
      service.isActive = Boolean(req.body.isActive);
    }
    if (
      req.body?.sortOrder !== undefined &&
      Number.isFinite(Number(req.body.sortOrder))
    ) {
      service.sortOrder = Number(req.body.sortOrder);
    }

    await service.save();
    return res.json({ service });
  } catch (error) {
    return next(error);
  }
});

router.delete('/services/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    const deleted = await Service.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    return res.json({ ok: true, id });
  } catch (error) {
    return next(error);
  }
});

// --- Site Settings (WhatsApp number & storefront copy) ---
router.get('/settings', async (_req, res, next) => {
  try {
    const settingsDoc = await SiteSettings.findOne({ key: 'global' }).lean();
    return res.json({ settings: serializeSettings(settingsDoc) });
  } catch (error) {
    return next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    let settings = await SiteSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new SiteSettings({ key: 'global' });
    }

    if (req.body?.whatsappNumber !== undefined) {
      const raw = String(req.body.whatsappNumber || '').trim();
      if (raw === '') {
        settings.whatsappNumber = '';
      } else {
        const normalized = normalizeWhatsAppNumber(raw);
        if (!isValidWhatsAppNumber(normalized)) {
          return res.status(400).json({
            error:
              'Enter a valid international WhatsApp number with country code (8–15 digits, e.g., +94 77 123 4567).',
          });
        }
        settings.whatsappNumber = normalized;
      }
    }

    if (req.body?.whatsappLink !== undefined) {
      const raw = String(req.body.whatsappLink || '').trim();
      if (raw === '') {
        settings.whatsappLink = '';
      } else {
        if (!isValidWhatsAppLink(raw)) {
          return res.status(400).json({
            error:
              'Enter a valid HTTPS WhatsApp link (e.g., https://wa.me/message/... or https://chat.whatsapp.com/...).',
          });
        }
        settings.whatsappLink = sanitizeWhatsAppLink(raw);
      }
    }

    if (req.body?.whatsappMode !== undefined) {
      const mode = String(req.body.whatsappMode || '').trim();
      if (mode !== 'number' && mode !== 'link') {
        return res.status(400).json({ error: 'Invalid WhatsApp mode.' });
      }
      settings.whatsappMode = mode;
    }

    if (req.body?.whatsappEnabled !== undefined) {
      settings.whatsappEnabled = Boolean(req.body.whatsappEnabled);
    }

    if (req.body?.telegramHandle !== undefined) {
      const raw = String(req.body.telegramHandle || '').trim();
      if (raw === '') {
        settings.telegramHandle = '';
      } else {
        const normalized = normalizeTelegramHandle(raw);
        if (!isValidTelegramHandle(normalized)) {
          return res.status(400).json({
            error:
              'Enter a valid Telegram @username (5–32 letters, numbers, underscores) or international phone number (e.g., +94 77 123 4567).',
          });
        }
        settings.telegramHandle = normalized;
      }
    }

    if (req.body?.telegramLink !== undefined) {
      const raw = String(req.body.telegramLink || '').trim();
      if (raw === '') {
        settings.telegramLink = '';
      } else {
        if (!isValidTelegramLink(raw)) {
          return res.status(400).json({
            error:
              'Enter a valid HTTPS Telegram link (e.g., https://t.me/COLOMBOTOURS).',
          });
        }
        settings.telegramLink = sanitizeTelegramLink(raw);
      }
    }

    if (req.body?.telegramMode !== undefined) {
      const mode = String(req.body.telegramMode || '').trim();
      if (mode !== 'handle' && mode !== 'link') {
        return res.status(400).json({ error: 'Invalid Telegram mode.' });
      }
      settings.telegramMode = mode;
    }

    if (req.body?.telegramEnabled !== undefined) {
      settings.telegramEnabled = Boolean(req.body.telegramEnabled);
    }

    if (req.body?.wechatId !== undefined) {
      const raw = String(req.body.wechatId || '').trim();
      if (raw === '') {
        settings.wechatId = '';
      } else {
        const normalized = normalizeWeChatId(raw);
        if (!isValidWeChatId(normalized)) {
          return res.status(400).json({
            error:
              'Enter a valid WeChat ID (6–20 characters starting with a letter) or international phone number (e.g., +94 77 123 4567).',
          });
        }
        settings.wechatId = normalized;
      }
    }

    if (req.body?.wechatLink !== undefined) {
      const raw = String(req.body.wechatLink || '').trim();
      if (raw === '') {
        settings.wechatLink = '';
      } else {
        if (!isValidWeChatLink(raw)) {
          return res.status(400).json({
            error:
              'Enter a valid HTTPS WeChat link (e.g., https://u.wechat.com/...).',
          });
        }
        settings.wechatLink = sanitizeWeChatLink(raw);
      }
    }

    if (req.body?.wechatMode !== undefined) {
      const mode = String(req.body.wechatMode || '').trim();
      if (mode !== 'id' && mode !== 'link') {
        return res.status(400).json({ error: 'Invalid WeChat mode.' });
      }
      settings.wechatMode = mode;
    }

    if (req.body?.wechatEnabled !== undefined) {
      settings.wechatEnabled = Boolean(req.body.wechatEnabled);
    }

    let removedQrPhoto = null;
    if (req.body?.wechatQrUrl !== undefined) {
      const raw = String(req.body.wechatQrUrl || '').trim();
      const prevQrUrl = settings.wechatQrUrl || '';
      const prevProvider = settings.wechatQrStorageProvider || '';
      const prevMediaId = settings.wechatQrMediaId || '';

      if (raw === '') {
        if (prevQrUrl) {
          removedQrPhoto = {
            url: prevQrUrl,
            storageProvider: prevProvider,
            mediaId: prevMediaId,
          };
        }
        settings.wechatQrUrl = '';
        settings.wechatQrStorageProvider = '';
        settings.wechatQrMediaId = '';
      } else {
        const safeUrl = sanitizeSafeImageUrl(raw);
        if (!safeUrl) {
          return res.status(400).json({
            error:
              'WeChat QR code URL must be a valid HTTPS image URL or uploaded image path.',
          });
        }
        if (prevQrUrl && prevQrUrl !== safeUrl) {
          removedQrPhoto = {
            url: prevQrUrl,
            storageProvider: prevProvider,
            mediaId: prevMediaId,
          };
        }
        const allowedProviders = [
          'static',
          'cloudinary',
          'vercel-blob',
          'mongodb',
          'external',
        ];
        const nextProvider = allowedProviders.includes(
          req.body?.wechatQrStorageProvider
        )
          ? req.body.wechatQrStorageProvider
          : safeUrl.startsWith('/api/media/')
            ? 'mongodb'
            : safeUrl.startsWith('/')
              ? 'static'
              : 'external';
        settings.wechatQrUrl = safeUrl;
        settings.wechatQrStorageProvider = nextProvider;
        settings.wechatQrMediaId = String(
          req.body?.wechatQrMediaId || ''
        )
          .trim()
          .slice(0, 200);
      }
    }

    if (req.body?.companyName !== undefined) {
      const v = String(req.body.companyName || '').trim();
      if (v) settings.companyName = v.slice(0, 100);
    }
    if (req.body?.tagline !== undefined) {
      settings.tagline = String(req.body.tagline || '').trim().slice(0, 140);
    }
    if (req.body?.heroHeadline !== undefined) {
      const v = String(req.body.heroHeadline || '').trim();
      if (v) settings.heroHeadline = v.slice(0, 140);
    }
    if (req.body?.heroSubheadline !== undefined) {
      settings.heroSubheadline = String(req.body.heroSubheadline || '')
        .trim()
        .slice(0, 260);
    }
    if (req.body?.supportGreeting !== undefined) {
      settings.supportGreeting = String(req.body.supportGreeting || '')
        .trim()
        .slice(0, 400);
    }

    await settings.save();
    if (removedQrPhoto) {
      await deleteStoredImage(removedQrPhoto);
    }
    return res.json({ settings: serializeSettings(settings.toObject()) });
  } catch (error) {
    return next(error);
  }
});

/**
 * SSRF-safe, rate-limited verification of whether a Telegram @username actually exists
 * on Telegram (preventing "User not found" errors on customers' mobile apps).
 */
router.post(
  '/settings/verify-telegram',
  telegramVerifyLimiter,
  async (req, res) => {
    const mode = req.body?.mode === 'link' ? 'link' : 'handle';
    let targetRaw = '';

    if (mode === 'link') {
      const safeLink = sanitizeTelegramLink(String(req.body?.link || ''));
      if (!safeLink) {
        return res.status(400).json({
          error:
            'Enter a valid HTTPS Telegram link (e.g., https://t.me/YourUsername) before verifying.',
        });
      }
      try {
        const parsed = new URL(safeLink);
        const pathSegment = parsed.pathname.replace(/^\/+|\/+$/g, '');
        if (
          pathSegment.startsWith('+') &&
          !STRICT_TELEGRAM_PHONE_REGEX.test(pathSegment)
        ) {
          return res.json({
            reachable: null,
            status: 'invite_link',
            target: safeLink,
            message:
              'Private Telegram invite links cannot be checked automatically. Please test by opening it in the Telegram mobile app.',
          });
        }
        targetRaw = pathSegment;
      } catch {
        return res.status(400).json({ error: 'Invalid Telegram link.' });
      }
    } else {
      targetRaw = String(req.body?.handle || '').trim();
    }

    const normalized = normalizeTelegramHandle(targetRaw);
    if (!isValidTelegramHandle(normalized)) {
      return res.status(400).json({
        error:
          'Enter a valid Telegram @username (5–32 letters, numbers, underscores) or international phone number (+94...).',
      });
    }

    if (STRICT_TELEGRAM_PHONE_REGEX.test(normalized)) {
      return res.json({
        reachable: null,
        status: 'phone_privacy_dependent',
        target: normalized,
        message:
          'Phone links (t.me/+...) work on mobile only when Telegram Settings → Privacy & Security → Phone Number → "Who can find me by my number" is set to Everybody. For maximum reliability, a public @username is recommended.',
      });
    }

    if (!STRICT_TELEGRAM_USERNAME_REGEX.test(normalized)) {
      return res.status(400).json({ error: 'Invalid Telegram username.' });
    }

    // Hardcoded Telegram origin + strictly regex-validated username -> zero SSRF surface
    const checkUrl = `https://t.me/${normalized}`;
    try {
      const response = await fetch(checkUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'ColomboToursAdminCheck/1.0',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (!response.ok) {
        return res.json({
          reachable: null,
          status: 'check_unavailable',
          target: `@${normalized}`,
          message:
            'Could not verify this username with Telegram right now. Please test directly in the Telegram mobile app.',
        });
      }

      const html = (await response.text()).slice(0, 65536);
      const exists = html.includes('tgme_page_title');
      if (exists) {
        const displayName = extractTelegramDisplayName(html);
        return res.json({
          reachable: true,
          status: 'active',
          target: `@${normalized}`,
          displayName,
          message: displayName
            ? `Active on Telegram (${displayName}). Mobile and web visitors will open this chat directly.`
            : `Active on Telegram. Mobile and web visitors will open @${normalized} directly.`,
        });
      }

      return res.json({
        reachable: false,
        status: 'not_found',
        target: `@${normalized}`,
        message: `Telegram username @${normalized} was not found on Telegram. Customers on mobile will see "User not found" until you claim @${normalized} in Telegram (Settings → Username), enter your active @username, or switch to your Telegram phone number (+94...).`,
      });
    } catch {
      return res.json({
        reachable: null,
        status: 'check_unavailable',
        target: `@${normalized}`,
        message:
          'Could not reach Telegram servers right now to verify this username. Please test directly on your phone.',
      });
    }
  }
);

export default router;
