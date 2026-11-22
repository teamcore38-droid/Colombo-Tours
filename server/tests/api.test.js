import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    expect(res.body.settings.whatsappConfigured).toBe(false);
    expect(res.body.settings.whatsappNumber).toBe('');
    expect(res.body.categories.length).toBeGreaterThanOrEqual(4);
    expect(res.body.services.length).toBeGreaterThanOrEqual(4);
    expect(res.body.vehicles.length).toBeGreaterThanOrEqual(5);

    const catSlugs = res.body.categories.map((c) => c.slug);
    expect(catSlugs).toEqual(
      expect.arrayContaining(['luxury', 'suv', 'wedding', 'chauffeur'])
    );
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

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r3.status).toBe(401);
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

    // Save valid Sri Lankan WhatsApp number
    const goodWa = await agent
      .put('/api/admin/settings')
      .send({ whatsappNumber: '+94 77 123 4567' });
    expect(goodWa.status).toBe(200);
    expect(goodWa.body.settings.whatsappNumber).toBe('94771234567');
    expect(goodWa.body.settings.whatsappConfigured).toBe(true);

    // Verify public settings immediately reflect updated WhatsApp number
    const pubSettings = await request(app).get('/api/settings');
    expect(pubSettings.body.settings.whatsappNumber).toBe('94771234567');
    expect(pubSettings.body.settings.whatsappConfigured).toBe(true);

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

    // Create a new vehicle with uploaded photo & category
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
      photos: [{ ...uploadedPhoto, isPrimary: true }],
      isPublished: true,
    });
    expect(createRes.status).toBe(201);
    const createdVehicle = createRes.body.vehicle;
    expect(createdVehicle.slug).toBe('2025-audi-a8-l');

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

    // Clear WhatsApp number -> disables WhatsApp across site again
    const clearWa = await agent
      .put('/api/admin/settings')
      .send({ whatsappNumber: '' });
    expect(clearWa.status).toBe(200);
    expect(clearWa.body.settings.whatsappConfigured).toBe(false);
  });
});
