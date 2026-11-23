import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Service } from '../models/Service.js';
import { SiteSettings } from '../models/SiteSettings.js';
import { Vehicle } from '../models/Vehicle.js';
import {
  formatWhatsAppDisplay,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from '../utils/whatsapp.js';

const router = Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cache public read endpoints at Vercel's Edge PoP for 60s and serve stale for up to 10m
 * while revalidating in the background. Skip edge caching only when explicitly requested
 * via ?fresh=1 (used right after an admin edit in the same browser).
 */
function setPublicEdgeCache(req, res) {
  if (req.query?.fresh === '1') {
    res.set('Cache-Control', 'no-store');
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
  const configured = isValidWhatsAppNumber(digits);
  return {
    companyName: doc?.companyName || 'Colombo Tours',
    tagline: doc?.tagline || 'Built Trust in Excellence',
    whatsappNumber: configured ? digits : '',
    whatsappDisplay: configured ? formatWhatsAppDisplay(digits) : '',
    whatsappConfigured: configured,
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
        .lean(),
      Service.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      Vehicle.find({ isPublished: true })
        .populate('categories', 'name slug sortOrder isActive')
        .sort({ sortOrder: 1, createdAt: -1 })
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

    const trimmedSearch = String(search).trim();
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
