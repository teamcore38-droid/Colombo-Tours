import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Media } from '../src/models/Media.js';
import { ensureBaseSetup } from '../src/utils/seed.js';

// Minimal valid 1x1 PNG binary (passes magic-byte inspection)
const VALID_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDB(mongoServer.getUri());
  await ensureBaseSetup({ forceSeedFleet: true });
  app = createApp({ skipDbMiddleware: true });
}, 60000);

afterAll(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Colombo Tours API', () => {
  it('returns health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('bootstraps with seeded Sri Lankan fleet and disabled WhatsApp by default', async () => {
    const res = await request(app).get('/api/bootstrap');
    expect(res.status).toBe(200);
    expect(res.headers['cdn-cache-control']).toContain('s-maxage=60');
    expect(res.headers['cdn-cache-control']).toContain('stale-while-revalidate');
    expect(res.body.settings.whatsappConfigured).toBe(false);
    expect(res.body.settings.whatsappNumber).toBe('');
    expect(res.body.settings.telegramConfigured).toBe(false);
    expect(res.body.settings.telegramHandle).toBe('');
    expect(res.body.settings.wechatConfigured).toBe(false);
    expect(res.body.settings.wechatId).toBe('');
    expect(res.body.categories.length).toBeGreaterThanOrEqual(4);
    expect(res.body.services.length).toBeGreaterThanOrEqual(4);
    expect(res.body.vehicles.length).toBeGreaterThanOrEqual(5);

    const catSlugs = res.body.categories.map((c) => c.slug);
    expect(catSlugs).toEqual(
      expect.arrayContaining(['luxury', 'suv', 'wedding', 'chauffeur'])
    );

    const freshRes = await request(app).get('/api/bootstrap?fresh=1');
    expect(freshRes.status).toBe(200);
    expect(freshRes.headers['cache-control']).toBe('no-store');
  });

  it('filters and searches public vehicles and handles empty results cleanly', async () => {
    const searchRes = await request(app).get('/api/vehicles?search=Defender');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.vehicles.length).toBe(1);
    expect(searchRes.body.vehicles[0].name).toContain('Defender');

    const catRes = await request(app).get('/api/vehicles?category=wedding');
    expect(catRes.status).toBe(200);
    expect(catRes.body.vehicles.length).toBeGreaterThanOrEqual(1);

    const emptyRes = await request(app).get(
      '/api/vehicles?search=NonExistentSpaceship999'
    );
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.vehicles).toEqual([]);
  });

  it('blocks unauthenticated access to protected admin routes', async () => {
    const r1 = await request(app).get('/api/admin/vehicles');
    const r2 = await request(app)
      .put('/api/admin/settings')
      .send({ whatsappNumber: '+94771234567' });
    const r3 = await request(app).post('/api/admin/vehicles').send({ name: 'Test' });
    const r4 = await request(app)
      .post('/api/admin/settings/verify-telegram')
      .send({ handle: '@ColomboTours' });

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r3.status).toBe(401);
    expect(r4.status).toBe(401);
  });

  it('serves fast 302 redirects on /v/:slug for browsers and escaped JPEG OG cards for WhatsApp/Telegram crawlers', async () => {
    const listRes = await request(app).get('/api/vehicles');
    expect(listRes.status).toBe(200);
    const sampleSlug = listRes.body.vehicles[0].slug;

    // Normal browser visitor gets an instant 302 redirect to /vehicle/<slug>
    const humanRes = await request(app)
      .get(`/v/${sampleSlug}`)
      .set(
        'User-Agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
      );
    expect(humanRes.status).toBe(302);
    expect(humanRes.headers.location).toBe(`/vehicle/${sampleSlug}`);
    expect(humanRes.headers['cache-control']).toBe('no-store');

    // Malformed / XSS slug safely redirects to /
    const badSlugRes = await request(app)
      .get('/v/%3Cscript%3Ealert(1)%3C%2Fscript%3E')
      .set('User-Agent', 'WhatsApp/2.24.1');
    expect(badSlugRes.status).toBe(302);
    expect(badSlugRes.headers.location).toBe('/');

    // WhatsApp & Telegram crawlers receive escaped OG HTML with no inline script tags
    const waCrawlerRes = await request(app)
      .get(`/v/${sampleSlug}`)
      .set('User-Agent', 'WhatsApp/2.24.1.78 A');
    expect(waCrawlerRes.status).toBe(200);
    expect(waCrawlerRes.headers['content-type']).toContain('text/html');
    expect(waCrawlerRes.text).toContain('property="og:title"');
    expect(waCrawlerRes.text).toContain('property="og:description"');
    expect(waCrawlerRes.text).toContain(`/v/${sampleSlug}`);
    expect(waCrawlerRes.text).not.toContain('<script');

    // Non-existent slug redirects crawler safely to /
    const missingRes = await request(app)
      .get('/v/non-existent-vehicle-999')
      .set('User-Agent', 'TelegramBot (like TwitterBot)');
    expect(missingRes.status).toBe(302);
    expect(missingRes.headers.location).toBe('/');
  });

  it('verifies Telegram handles safely in Admin and converts Cloudinary WebP to JPEG for OG previews', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({
      email: 'admin@colombotours.lk',
      password: 'ChangeMe123!',
    });
    expect(loginRes.status).toBe(200);

    // Invalid handle & SSRF-attempt link are rejected with 400
    const badHandle = await agent
      .post('/api/admin/settings/verify-telegram')
      .send({ mode: 'handle', handle: 'ab!' });
    expect(badHandle.status).toBe(400);

    const ssrfAttempt = await agent
      .post('/api/admin/settings/verify-telegram')
      .send({ mode: 'link', link: 'https://169.254.169.254/latest/meta-data/' });
    expect(ssrfAttempt.status).toBe(400);

    // Phone number returns privacy-dependent notice without outbound fetch
    const phoneCheck = await agent
      .post('/api/admin/settings/verify-telegram')
      .send({ mode: 'handle', handle: '+94 72 573 7391' });
    expect(phoneCheck.status).toBe(200);
    expect(phoneCheck.body.status).toBe('phone_privacy_dependent');
    expect(phoneCheck.body.reachable).toBeNull();

    // Private invite link returns invite_link notice
    const inviteCheck = await agent
      .post('/api/admin/settings/verify-telegram')
      .send({ mode: 'link', link: 'https://t.me/+AbCdEfGh12345' });
    expect(inviteCheck.status).toBe(200);
    expect(inviteCheck.body.status).toBe('invite_link');

    // Mocked Telegram HTML check: active username vs non-existent username
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          '<div class="tgme_page_title"><span>Colombo Tours Official</span></div>',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<div class="tgme_page_icon"><i class="tgme_icon_user"></i></div>',
      });

    try {
      const activeRes = await agent
        .post('/api/admin/settings/verify-telegram')
        .send({ mode: 'handle', handle: '@ColomboToursOfficial' });
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.reachable).toBe(true);
      expect(activeRes.body.status).toBe('active');
      expect(activeRes.body.displayName).toBe('Colombo Tours Official');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://t.me/ColomboToursOfficial',
        expect.objectContaining({ redirect: 'manual' })
      );

      const missingUserRes = await agent
        .post('/api/admin/settings/verify-telegram')
        .send({ mode: 'handle', handle: '@COLOMBOTOURS' });
      expect(missingUserRes.status).toBe(200);
      expect(missingUserRes.body.reachable).toBe(false);
      expect(missingUserRes.body.status).toBe('not_found');
    } finally {
      fetchSpy.mockRestore();
    }

    // Create vehicle with HTML-sensitive chars + Cloudinary WebP photo to test XSS escaping & JPG OG transform
    const vRes = await agent.post('/api/admin/vehicles').send({
      name: '2026 Luxury <"Test"> Sedan',
      model: 'Test & Co',
      photos: [
        {
          url: 'https://res.cloudinary.com/demo/image/upload/v123/colombo-tours/test-car.webp',
          alt: 'Test car',
          storageProvider: 'cloudinary',
          isPrimary: true,
        },
      ],
      isPublished: true,
    });
    expect(vRes.status).toBe(201);
    const vSlug = vRes.body.vehicle.slug;

    try {
      const ogRes = await request(app)
        .get(`/v/${vSlug}`)
        .set('User-Agent', 'WhatsApp/2.24.1');
      expect(ogRes.status).toBe(200);
      expect(ogRes.text).toContain('&lt;&quot;Test&quot;&gt;');
      expect(ogRes.text).not.toContain('<"Test">');
      expect(ogRes.text).toContain(
        'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto:good,w_1200,h_630,c_fill,g_auto/v123/colombo-tours/test-car.jpg'
      );
    } finally {
      await agent.delete(`/api/admin/vehicles/${vRes.body.vehicle._id}`);
    }
  });

  it('handles staff authentication, WhatsApp number updates, uploads, and vehicle lifecycle', async () => {
    const agent = request.agent(app);

    // Reject wrong password
    const badLogin = await agent.post('/api/auth/login').send({
      email: 'admin@colombotours.lk',
      password: 'WrongPassword!',
    });
    expect(badLogin.status).toBe(401);

    // Valid login
    const goodLogin = await agent.post('/api/auth/login').send({
      email: 'admin@colombotours.lk',
      password: 'ChangeMe123!',
    });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body.admin.email).toBe('admin@colombotours.lk');

    // Verify /me session
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.admin.role).toBe('admin');

    // Reject invalid WhatsApp number (missing country code / leading 0)
    const badWa = await agent
      .put('/api/admin/settings')
      .send({ whatsappNumber: '0771234567' });
    expect(badWa.status).toBe(400);

    // Reject invalid Telegram handle, invalid WeChat ID, and XSS WeChat QR URL
    const badTg = await agent
      .put('/api/admin/settings')
      .send({ telegramHandle: 'ab!' });
    expect(badTg.status).toBe(400);

    const badWc = await agent
      .put('/api/admin/settings')
      .send({ wechatId: '123' });
    expect(badWc.status).toBe(400);

    const badQr = await agent
      .put('/api/admin/settings')
      .send({ wechatQrUrl: 'javascript:alert(1)' });
    expect(badQr.status).toBe(400);

    // Reject phishing / non-allowlisted / non-HTTPS direct social links & invalid mode
    const badWaLink = await agent
      .put('/api/admin/settings')
      .send({ whatsappLink: 'https://evil.example/message/123' });
    expect(badWaLink.status).toBe(400);

    const badTgLink = await agent
      .put('/api/admin/settings')
      .send({ telegramLink: 'http://t.me/COLOMBOTOURS' });
    expect(badTgLink.status).toBe(400);

    const badWcLink = await agent
      .put('/api/admin/settings')
      .send({ wechatLink: 'javascript:alert(1)' });
    expect(badWcLink.status).toBe(400);

    const badMode = await agent
      .put('/api/admin/settings')
      .send({ whatsappMode: 'sms' });
    expect(badMode.status).toBe(400);

    // Save valid WhatsApp, Telegram, and WeChat settings (both number/ID and official links)
    const goodWa = await agent
      .put('/api/admin/settings')
      .send({
        whatsappNumber: '+94 77 123 4567',
        whatsappLink: 'https://wa.me/message/KSBZDVJTSEJYC1?src=qr',
        whatsappMode: 'number',
        whatsappEnabled: true,
        telegramHandle: 'https://t.me/ColomboTours',
        telegramLink: 'https://t.me/COLOMBOTOURS',
        telegramMode: 'handle',
        telegramEnabled: true,
        wechatId: 'ColomboToursLK',
        wechatLink: 'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2',
        wechatMode: 'link',
        wechatEnabled: true,
      });
    expect(goodWa.status).toBe(200);
    expect(goodWa.body.settings.whatsappNumber).toBe('94771234567');
    expect(goodWa.body.settings.whatsappLink).toBe(
      'https://wa.me/message/KSBZDVJTSEJYC1?src=qr'
    );
    expect(goodWa.body.settings.whatsappConfigured).toBe(true);
    expect(goodWa.body.settings.telegramHandle).toBe('ColomboTours');
    expect(goodWa.body.settings.telegramDisplay).toBe('@ColomboTours');
    expect(goodWa.body.settings.telegramConfigured).toBe(true);
    expect(goodWa.body.settings.wechatId).toBe('ColomboToursLK');
    expect(goodWa.body.settings.wechatLink).toBe(
      'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2'
    );
    expect(goodWa.body.settings.wechatMode).toBe('link');
    expect(goodWa.body.settings.wechatConfigured).toBe(true);

    // Unticking a channel disables it while keeping its saved value intact
    const disableWc = await agent
      .put('/api/admin/settings')
      .send({ wechatEnabled: false });
    expect(disableWc.status).toBe(200);
    expect(disableWc.body.settings.wechatConfigured).toBe(false);
    expect(disableWc.body.settings.wechatLink).toBe(
      'https://u.wechat.com/kHm8VCFbetF_uPu8roHEfig?s=2'
    );

    const reEnableWc = await agent
      .put('/api/admin/settings')
      .send({ wechatEnabled: true });
    expect(reEnableWc.status).toBe(200);
    expect(reEnableWc.body.settings.wechatConfigured).toBe(true);

    // Verify public settings immediately reflect all 3 updated booking channels
    const pubSettings = await request(app).get('/api/settings');
    expect(pubSettings.body.settings.whatsappNumber).toBe('94771234567');
    expect(pubSettings.body.settings.whatsappConfigured).toBe(true);
    expect(pubSettings.body.settings.telegramHandle).toBe('ColomboTours');
    expect(pubSettings.body.settings.telegramConfigured).toBe(true);
    expect(pubSettings.body.settings.wechatId).toBe('ColomboToursLK');
    expect(pubSettings.body.settings.wechatConfigured).toBe(true);

    // Reject spoofed non-image upload
    const badUpload = await agent
      .post('/api/admin/uploads')
      .attach('photos', Buffer.from('not a real png image file'), {
        filename: 'fake.png',
        contentType: 'image/png',
      });
    expect(badUpload.status).toBe(400);

    // Upload valid PNG photo
    const uploadRes = await agent
      .post('/api/admin/uploads')
      .attach('photos', VALID_PNG_BUFFER, {
        filename: 'test-car.png',
        contentType: 'image/png',
      });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.photos.length).toBe(1);
    const uploadedPhoto = uploadRes.body.photos[0];
    expect(uploadedPhoto.url).toMatch(/^\/api\/media\//);

    // Verify uploaded media serves cleanly with immutable cache header
    const mediaRes = await request(app).get(uploadedPhoto.url);
    expect(mediaRes.status).toBe(200);
    expect(mediaRes.headers['content-type']).toBe('image/png');
    expect(mediaRes.headers['cache-control']).toContain('immutable');

    // Create a new category
    const catRes = await agent.post('/api/admin/categories').send({
      name: 'Self-Drive',
      description: 'Approved self-drive rentals',
    });
    expect(catRes.status).toBe(201);
    const createdCat = catRes.body.category;

    // Create a new vehicle with uploaded photo & category (also verify Cloudinary provider accepted)
    const createRes = await agent.post('/api/admin/vehicles').send({
      name: '2025 Audi A8 L',
      model: 'Audi A8 Long Wheelbase',
      year: 2025,
      categories: [createdCat._id],
      specs: {
        seats: 5,
        transmission: 'Automatic',
        luggage: '3 Suitcases',
        chauffeur: 'Chauffeur Included',
      },
      photos: [
        { ...uploadedPhoto, isPrimary: true },
        {
          url: 'https://res.cloudinary.com/demo/image/upload/v1/colombo-tours/sample.webp',
          alt: 'Cloudinary sample',
          storageProvider: 'cloudinary',
          mediaId: 'colombo-tours/vehicles/sample',
          isPrimary: false,
        },
      ],
      isPublished: true,
    });
    expect(createRes.status).toBe(201);
    const createdVehicle = createRes.body.vehicle;
    expect(createdVehicle.slug).toBe('2025-audi-a8-l');
    expect(createdVehicle.photos[1].storageProvider).toBe('cloudinary');

    // Public detail endpoint finds it
    const pubDetail = await request(app).get(
      `/api/vehicles/${createdVehicle.slug}`
    );
    expect(pubDetail.status).toBe(200);
    expect(pubDetail.body.vehicle.name).toBe('2025 Audi A8 L');

    // Unpublish hides vehicle from public endpoints
    const unpubRes = await agent
      .patch(`/api/admin/vehicles/${createdVehicle._id}/publish`)
      .send({ isPublished: false });
    expect(unpubRes.status).toBe(200);
    expect(unpubRes.body.vehicle.isPublished).toBe(false);

    const hiddenDetail = await request(app).get(
      `/api/vehicles/${createdVehicle.slug}`
    );
    expect(hiddenDetail.status).toBe(404);

    // Still visible in admin list
    const adminList = await agent.get('/api/admin/vehicles?status=unpublished');
    expect(adminList.status).toBe(200);
    expect(
      adminList.body.vehicles.some((v) => v._id === createdVehicle._id)
    ).toBe(true);

    // Delete vehicle and confirm uploaded Media cleanup
    const delRes = await agent.delete(`/api/admin/vehicles/${createdVehicle._id}`);
    expect(delRes.status).toBe(200);
    const mediaAfterDelete = await Media.findById(uploadedPhoto.mediaId);
    expect(mediaAfterDelete).toBeNull();

    // Delete test category
    const delCatRes = await agent.delete(`/api/admin/categories/${createdCat._id}`);
    expect(delCatRes.status).toBe(200);

    // Upload a WeChat QR image, attach to settings, then clear and confirm cleanup
    const qrUploadRes = await agent
      .post('/api/admin/uploads')
      .attach('photos', VALID_PNG_BUFFER, {
        filename: 'wechat-qr.png',
        contentType: 'image/png',
      });
    expect(qrUploadRes.status).toBe(201);
    const qrPhoto = qrUploadRes.body.photos[0];

    const saveQrRes = await agent.put('/api/admin/settings').send({
      wechatQrUrl: qrPhoto.url,
      wechatQrStorageProvider: qrPhoto.storageProvider,
      wechatQrMediaId: qrPhoto.mediaId,
    });
    expect(saveQrRes.status).toBe(200);
    expect(saveQrRes.body.settings.wechatQrUrl).toBe(qrPhoto.url);

    // Clear all booking channels -> disables all 3 across site and cleans up QR media
    const clearChannels = await agent.put('/api/admin/settings').send({
      whatsappNumber: '',
      whatsappLink: '',
      telegramHandle: '',
      telegramLink: '',
      wechatId: '',
      wechatLink: '',
      wechatQrUrl: '',
    });
    expect(clearChannels.status).toBe(200);
    expect(clearChannels.body.settings.whatsappConfigured).toBe(false);
    expect(clearChannels.body.settings.telegramConfigured).toBe(false);
    expect(clearChannels.body.settings.wechatConfigured).toBe(false);
    const qrAfterClear = await Media.findById(qrPhoto.mediaId);
    expect(qrAfterClear).toBeNull();
  });
});
