import { Category } from '../models/Category.js';
import { Service } from '../models/Service.js';
import { SiteSettings } from '../models/SiteSettings.js';
import { Vehicle } from '../models/Vehicle.js';
import {
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
} from './channels.js';
import { slugify } from './slug.js';

export const BACKUP_APP_ID = 'colombo-tours';
export const BACKUP_SCHEMA_VERSION = 1;

const MAX_BACKUP_CATEGORIES = 100;
const MAX_BACKUP_SERVICES = 100;
const MAX_BACKUP_VEHICLES = 500;
const MAX_PHOTOS_PER_VEHICLE = 20;

const ALLOWED_SERVICE_ICONS = new Set([
  'plane',
  'heart',
  'compass',
  'briefcase',
  'car',
]);

const ALLOWED_STORAGE_PROVIDERS = new Set([
  'static',
  'cloudinary',
  'vercel-blob',
  'mongodb',
  'external',
]);

function createValidationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function sanitizeBackupPhotos(rawPhotos) {
  if (!Array.isArray(rawPhotos)) return [];
  const clean = [];
  for (const item of rawPhotos.slice(0, MAX_PHOTOS_PER_VEHICLE)) {
    if (!item || typeof item !== 'object') continue;
    const url = String(item.url || '').trim();
    if (!url || url.length > 500 || /[\x00-\x1f\s]/.test(url)) continue;

    const isSafeRelative = url.startsWith('/') && !url.startsWith('//');
    const isSafeHttp = /^https?:\/\/[^\s]+$/i.test(url);
    if (!isSafeRelative && !isSafeHttp) continue;

    clean.push({
      url,
      alt: String(item.alt || '').trim().slice(0, 160),
      storageProvider: ALLOWED_STORAGE_PROVIDERS.has(item.storageProvider)
        ? item.storageProvider
        : url.startsWith('/api/media/')
          ? 'mongodb'
          : url.startsWith('/vehicles/')
            ? 'static'
            : 'external',
      mediaId: String(item.mediaId || '').trim().slice(0, 200),
      isPrimary: Boolean(item.isPrimary),
    });
  }

  if (clean.length > 0 && !clean.some((p) => p.isPrimary)) {
    clean[0].isPrimary = true;
  }
  return clean;
}

function sanitizeBackupSpecs(rawSpecs = {}) {
  const specs = rawSpecs && typeof rawSpecs === 'object' ? rawSpecs : {};
  const seatsNum =
    specs.seats === '' || specs.seats === null || specs.seats === undefined
      ? null
      : Number(specs.seats);

  return {
    seats:
      seatsNum !== null &&
      Number.isFinite(seatsNum) &&
      seatsNum >= 1 &&
      seatsNum <= 60
        ? Math.round(seatsNum)
        : null,
    transmission: String(specs.transmission || '').trim().slice(0, 40),
    luggage: String(specs.luggage || '').trim().slice(0, 60),
    chauffeur: String(specs.chauffeur || '').trim().slice(0, 60),
    fuelType: String(specs.fuelType || '').trim().slice(0, 40),
    airConditioning:
      specs.airConditioning === undefined
        ? true
        : Boolean(specs.airConditioning),
  };
}

function sanitizeBackupHighlights(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item || '').trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 12);
}

function sanitizeBackupSettings(rawSettings) {
  if (!rawSettings || typeof rawSettings !== 'object') return null;

  const waDigits = normalizeWhatsAppNumber(
    String(rawSettings.whatsappNumber || '')
  );
  const waNumber = isValidWhatsAppNumber(waDigits) ? waDigits : '';
  const waLink = sanitizeWhatsAppLink(String(rawSettings.whatsappLink || ''));

  const tgRaw = normalizeTelegramHandle(
    String(rawSettings.telegramHandle || '')
  );
  const tgHandle = isValidTelegramHandle(tgRaw) ? tgRaw : '';
  const tgLink = sanitizeTelegramLink(String(rawSettings.telegramLink || ''));

  const wcRaw = normalizeWeChatId(String(rawSettings.wechatId || ''));
  const wcId = isValidWeChatId(wcRaw) ? wcRaw : '';
  const wcLink = sanitizeWeChatLink(String(rawSettings.wechatLink || ''));
  const wcQrUrl = sanitizeSafeImageUrl(String(rawSettings.wechatQrUrl || ''));
  const wcQrProvider = wcQrUrl
    ? ALLOWED_STORAGE_PROVIDERS.has(rawSettings.wechatQrStorageProvider)
      ? rawSettings.wechatQrStorageProvider
      : wcQrUrl.startsWith('/api/media/')
        ? 'mongodb'
        : wcQrUrl.startsWith('/')
          ? 'static'
          : 'external'
    : '';
  const wcQrMediaId = wcQrUrl
    ? String(rawSettings.wechatQrMediaId || '').trim().slice(0, 200)
    : '';

  return {
    companyName:
      String(rawSettings.companyName || '').trim().slice(0, 100) ||
      'Colombo Tours',
    tagline:
      String(rawSettings.tagline || '').trim().slice(0, 140) ||
      'Built Trust in Excellence',
    whatsappNumber: waNumber,
    whatsappLink: waLink,
    whatsappMode: rawSettings.whatsappMode === 'link' ? 'link' : 'number',
    whatsappEnabled: rawSettings.whatsappEnabled !== false,
    telegramHandle: tgHandle,
    telegramLink: tgLink,
    telegramMode: rawSettings.telegramMode === 'link' ? 'link' : 'handle',
    telegramEnabled: rawSettings.telegramEnabled !== false,
    wechatId: wcId,
    wechatLink: wcLink,
    wechatMode: rawSettings.wechatMode === 'link' ? 'link' : 'id',
    wechatEnabled: rawSettings.wechatEnabled !== false,
    wechatQrUrl: wcQrUrl,
    wechatQrStorageProvider: wcQrProvider,
    wechatQrMediaId: wcQrMediaId,
    heroHeadline:
      String(rawSettings.heroHeadline || '').trim().slice(0, 140) ||
      'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
    heroSubheadline: String(rawSettings.heroSubheadline || '')
      .trim()
      .slice(0, 260),
    supportGreeting: String(rawSettings.supportGreeting || '')
      .trim()
      .slice(0, 400),
  };
}

/**
 * Exports all business data (SiteSettings, Categories, Services, Vehicles)
 * as a portable JSON snapshot. Intentionally excludes AdminUser credentials/hashes
 * and raw binary Media buffers.
 */
export async function exportBackupSnapshot({ exportedBy = '' } = {}) {
  const [settingsDoc, categoriesDocs, servicesDocs, vehiclesDocs] =
    await Promise.all([
      SiteSettings.findOne({ key: 'global' }).lean(),
      Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
      Service.find().sort({ sortOrder: 1, name: 1 }).lean(),
      Vehicle.find()
        .populate('categories', 'slug')
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean(),
    ]);

  const categories = categoriesDocs.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    description: cat.description || '',
    sortOrder: Number.isFinite(Number(cat.sortOrder)) ? Number(cat.sortOrder) : 0,
    isActive: cat.isActive !== false,
  }));

  const services = servicesDocs.map((srv) => ({
    name: srv.name,
    slug: srv.slug,
    badge: srv.badge || '',
    description: srv.description || '',
    icon: ALLOWED_SERVICE_ICONS.has(srv.icon) ? srv.icon : 'car',
    whatsappLabel: srv.whatsappLabel || srv.name,
    isActive: srv.isActive !== false,
    sortOrder: Number.isFinite(Number(srv.sortOrder)) ? Number(srv.sortOrder) : 0,
  }));

  const vehicles = vehiclesDocs.map((v) => ({
    name: v.name,
    model: v.model || '',
    slug: v.slug,
    year: v.year ?? null,
    categorySlugs: (v.categories || [])
      .map((c) => (typeof c === 'object' && c?.slug ? String(c.slug) : ''))
      .filter(Boolean),
    summary: v.summary || '',
    description: v.description || '',
    specs: {
      seats: v.specs?.seats ?? null,
      transmission: v.specs?.transmission || '',
      luggage: v.specs?.luggage || '',
      chauffeur: v.specs?.chauffeur || '',
      fuelType: v.specs?.fuelType || '',
      airConditioning: v.specs?.airConditioning !== false,
    },
    highlights: Array.isArray(v.highlights) ? v.highlights : [],
    photos: (v.photos || []).map((p) => ({
      url: p.url,
      alt: p.alt || '',
      storageProvider: p.storageProvider || 'external',
      mediaId: p.mediaId || '',
      isPrimary: Boolean(p.isPrimary),
    })),
    isPublished: v.isPublished !== false,
    isFeatured: Boolean(v.isFeatured),
    sortOrder: Number.isFinite(Number(v.sortOrder)) ? Number(v.sortOrder) : 0,
  }));

  const settings = sanitizeBackupSettings(settingsDoc || {});

  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...(exportedBy ? { exportedBy: String(exportedBy).slice(0, 160) } : {}),
    counts: {
      categories: categories.length,
      services: services.length,
      vehicles: vehicles.length,
    },
    data: {
      settings,
      categories,
      services,
      vehicles,
    },
  };
}

/**
 * Strictly validates and sanitizes a backup payload before any database write.
 */
export function validateAndPrepareBackup(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw createValidationError(
      'Invalid backup file. Expected a Colombo Tours JSON backup object.'
    );
  }

  if (rawPayload.app !== BACKUP_APP_ID) {
    throw createValidationError(
      'Unrecognized backup file. Please select a valid Colombo Tours backup JSON.'
    );
  }

  if (rawPayload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw createValidationError(
      `Unsupported backup schema version (${rawPayload.schemaVersion ?? 'missing'}).`
    );
  }

  const data = rawPayload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw createValidationError('Backup file is missing its "data" section.');
  }

  if (!Array.isArray(data.categories)) {
    throw createValidationError('Backup file is missing a valid "categories" list.');
  }
  if (!Array.isArray(data.services)) {
    throw createValidationError('Backup file is missing a valid "services" list.');
  }
  if (!Array.isArray(data.vehicles)) {
    throw createValidationError('Backup file is missing a valid "vehicles" list.');
  }

  if (data.categories.length > MAX_BACKUP_CATEGORIES) {
    throw createValidationError(
      `Backup exceeds maximum allowed categories (${MAX_BACKUP_CATEGORIES}).`
    );
  }
  if (data.services.length > MAX_BACKUP_SERVICES) {
    throw createValidationError(
      `Backup exceeds maximum allowed services (${MAX_BACKUP_SERVICES}).`
    );
  }
  if (data.vehicles.length > MAX_BACKUP_VEHICLES) {
    throw createValidationError(
      `Backup exceeds maximum allowed vehicles (${MAX_BACKUP_VEHICLES}).`
    );
  }

  // Prepare categories with guaranteed unique slugs & names
  const seenCatSlugs = new Set();
  const seenCatNames = new Set();
  const categories = [];
  for (const rawCat of data.categories) {
    if (!rawCat || typeof rawCat !== 'object') continue;
    const name = String(rawCat.name || '').trim().slice(0, 60);
    if (!name) continue;
    const nameKey = name.toLowerCase();
    if (seenCatNames.has(nameKey)) continue;

    let slug = slugify(rawCat.slug || name).slice(0, 80);
    let suffix = 2;
    while (seenCatSlugs.has(slug)) {
      slug = `${slugify(rawCat.slug || name).slice(0, 72)}-${suffix}`;
      suffix += 1;
    }
    seenCatNames.add(nameKey);
    seenCatSlugs.add(slug);

    categories.push({
      name,
      slug,
      description: String(rawCat.description || '').trim().slice(0, 240),
      sortOrder: Number.isFinite(Number(rawCat.sortOrder))
        ? Number(rawCat.sortOrder)
        : categories.length + 1,
      isActive: rawCat.isActive !== false,
    });
  }

  // Prepare services with guaranteed unique slugs
  const seenServiceSlugs = new Set();
  const services = [];
  for (const rawSrv of data.services) {
    if (!rawSrv || typeof rawSrv !== 'object') continue;
    const name = String(rawSrv.name || '').trim().slice(0, 100);
    if (!name) continue;

    let slug = slugify(rawSrv.slug || name).slice(0, 120);
    let suffix = 2;
    while (seenServiceSlugs.has(slug)) {
      slug = `${slugify(rawSrv.slug || name).slice(0, 112)}-${suffix}`;
      suffix += 1;
    }
    seenServiceSlugs.add(slug);

    services.push({
      name,
      slug,
      badge: String(rawSrv.badge || '').trim().slice(0, 60),
      description: String(rawSrv.description || '').trim().slice(0, 400),
      icon: ALLOWED_SERVICE_ICONS.has(rawSrv.icon) ? rawSrv.icon : 'car',
      whatsappLabel: String(rawSrv.whatsappLabel || name).trim().slice(0, 120),
      isActive: rawSrv.isActive !== false,
      sortOrder: Number.isFinite(Number(rawSrv.sortOrder))
        ? Number(rawSrv.sortOrder)
        : services.length + 1,
    });
  }

  // Prepare vehicles with guaranteed unique slugs
  const seenVehicleSlugs = new Set();
  const vehicles = [];
  for (const rawVehicle of data.vehicles) {
    if (!rawVehicle || typeof rawVehicle !== 'object') continue;
    const name = String(rawVehicle.name || '').trim().slice(0, 120);
    if (!name) continue;

    let slug = slugify(rawVehicle.slug || name).slice(0, 150);
    let suffix = 2;
    while (seenVehicleSlugs.has(slug)) {
      slug = `${slugify(rawVehicle.slug || name).slice(0, 142)}-${suffix}`;
      suffix += 1;
    }
    seenVehicleSlugs.add(slug);

    const yearRaw = rawVehicle.year;
    const parsedYear =
      yearRaw === '' || yearRaw === null || yearRaw === undefined
        ? null
        : Number(yearRaw);
    const year =
      parsedYear !== null &&
      Number.isInteger(parsedYear) &&
      parsedYear >= 1950 &&
      parsedYear <= 2100
        ? parsedYear
        : null;

    const rawCatSlugs = Array.isArray(rawVehicle.categorySlugs)
      ? rawVehicle.categorySlugs
      : Array.isArray(rawVehicle.categories)
        ? rawVehicle.categories.map((c) =>
            typeof c === 'object' ? c?.slug || '' : String(c || '')
          )
        : [];
    const categorySlugs = Array.from(
      new Set(
        rawCatSlugs
          .map((s) => slugify(String(s || '')))
          .filter((s) => s && s !== 'item')
      )
    );

    vehicles.push({
      name,
      model: String(rawVehicle.model || '').trim().slice(0, 120),
      slug,
      year,
      categorySlugs,
      summary: String(rawVehicle.summary || '').trim().slice(0, 260),
      description: String(rawVehicle.description || '').trim().slice(0, 2000),
      specs: sanitizeBackupSpecs(rawVehicle.specs),
      highlights: sanitizeBackupHighlights(rawVehicle.highlights),
      photos: sanitizeBackupPhotos(rawVehicle.photos),
      isPublished: rawVehicle.isPublished !== false,
      isFeatured: Boolean(rawVehicle.isFeatured),
      sortOrder: Number.isFinite(Number(rawVehicle.sortOrder))
        ? Number(rawVehicle.sortOrder)
        : 0,
    });
  }

  const settings = data.settings ? sanitizeBackupSettings(data.settings) : null;

  return {
    settings,
    categories,
    services,
    vehicles,
  };
}

/**
 * Restores a validated backup snapshot into MongoDB.
 * - mode === 'replace': replaces Categories, Services, Vehicles, and SiteSettings cleanly
 *   (with automatic rollback if a DB error interrupts mid-write).
 * - mode === 'merge': non-destructively upserts by slug while keeping any newer items intact.
 *
 * NEVER touches AdminUser accounts or deletes stored Media/Cloudinary images.
 */
export async function restoreBackupSnapshot(
  rawPayload,
  { mode = 'replace' } = {}
) {
  if (mode !== 'replace' && mode !== 'merge') {
    throw createValidationError('Restore mode must be "replace" or "merge".');
  }

  const prepared = validateAndPrepareBackup(rawPayload);

  if (mode === 'merge') {
    // Upsert categories by slug or case-insensitive name
    for (const cat of prepared.categories) {
      const escapedName = cat.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await Category.findOne({
        $or: [
          { slug: cat.slug },
          { name: new RegExp(`^${escapedName}$`, 'i') },
        ],
      });
      if (existing) {
        existing.name = cat.name;
        existing.description = cat.description;
        existing.sortOrder = cat.sortOrder;
        existing.isActive = cat.isActive;
        await existing.save();
      } else {
        await Category.create(cat);
      }
    }

    const allCats = await Category.find().select('_id slug').lean();
    const catSlugToId = new Map(allCats.map((c) => [c.slug, c._id]));

    if (prepared.services.length > 0) {
      await Service.bulkWrite(
        prepared.services.map((srv) => ({
          updateOne: {
            filter: { slug: srv.slug },
            update: { $set: srv },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }

    if (prepared.vehicles.length > 0) {
      await Vehicle.bulkWrite(
        prepared.vehicles.map(({ categorySlugs, ...vehicleFields }) => {
          const categoryIds = categorySlugs
            .map((s) => catSlugToId.get(s))
            .filter(Boolean);
          return {
            updateOne: {
              filter: { slug: vehicleFields.slug },
              update: { $set: { ...vehicleFields, categories: categoryIds } },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
    }

    if (prepared.settings) {
      await SiteSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: prepared.settings, $setOnInsert: { key: 'global' } },
        { upsert: true, new: true, runValidators: true }
      );
    }

    return {
      ok: true,
      mode: 'merge',
      restored: {
        categories: prepared.categories.length,
        services: prepared.services.length,
        vehicles: prepared.vehicles.length,
        settingsUpdated: Boolean(prepared.settings),
      },
      restoredAt: new Date().toISOString(),
    };
  }

  // mode === 'replace': capture rollback snapshot in memory before replacing
  const [prevCategories, prevServices, prevVehicles, prevSettings] =
    await Promise.all([
      Category.find().lean(),
      Service.find().lean(),
      Vehicle.find().lean(),
      SiteSettings.findOne({ key: 'global' }).lean(),
    ]);

  try {
    await Promise.all([
      Vehicle.deleteMany({}),
      Category.deleteMany({}),
      Service.deleteMany({}),
    ]);

    const insertedCats = prepared.categories.length
      ? await Category.insertMany(prepared.categories)
      : [];
    const catSlugToId = new Map(insertedCats.map((c) => [c.slug, c._id]));

    if (prepared.services.length) {
      await Service.insertMany(prepared.services);
    }

    if (prepared.vehicles.length) {
      const vehicleDocs = prepared.vehicles.map(({ categorySlugs, ...fields }) => ({
        ...fields,
        categories: categorySlugs.map((s) => catSlugToId.get(s)).filter(Boolean),
      }));
      await Vehicle.insertMany(vehicleDocs);
    }

    if (prepared.settings) {
      await SiteSettings.findOneAndUpdate(
        { key: 'global' },
        { $set: prepared.settings, $setOnInsert: { key: 'global' } },
        { upsert: true, new: true, runValidators: true }
      );
    }

    return {
      ok: true,
      mode: 'replace',
      restored: {
        categories: prepared.categories.length,
        services: prepared.services.length,
        vehicles: prepared.vehicles.length,
        settingsUpdated: Boolean(prepared.settings),
      },
      restoredAt: new Date().toISOString(),
    };
  } catch (error) {
    // Best-effort rollback to previous state if an unexpected DB write error occurred
    try {
      await Promise.all([
        Vehicle.deleteMany({}),
        Category.deleteMany({}),
        Service.deleteMany({}),
      ]);
      if (prevCategories.length) await Category.insertMany(prevCategories);
      if (prevServices.length) await Service.insertMany(prevServices);
      if (prevVehicles.length) await Vehicle.insertMany(prevVehicles);
      if (prevSettings) {
        const { _id: _omitId, ...restSettings } = prevSettings;
        await SiteSettings.findOneAndUpdate(
          { key: 'global' },
          { $set: restSettings },
          { upsert: true }
        );
      }
    } catch (rollbackErr) {
      console.error('[Backup Restore] Rollback failed:', rollbackErr);
    }
    throw error;
  }
}
