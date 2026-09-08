import request from 'supertest';
import { createApp } from '../app';
import { initTestDb, cleanTestDb, createTestUser, createTestDriver, createTestRide, closeTestDb } from './helpers';
import { pool, query } from '../db';

// Mock AI face verification to always pass in tests
jest.mock('../utils/aiVision', () => ({
  verifyDriverFace: jest.fn().mockResolvedValue({
    isPerson: true,
    confidence: 0.95,
    label: 'person_test',
    reason: undefined,
  }),
}));

const app = createApp();

beforeAll(async () => {
  await initTestDb();
});

beforeEach(async () => {
  await cleanTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ─── POST /api/drivers/register ────────────────────────────────────────────
describe('POST /api/drivers/register', () => {
  it('should register a new driver with valid data', async () => {
    await createTestUser({ id: 'driver_reg_001', role: 'PASSENGER' });

    const longAvatarUrl = 'https://example.com/avatars/' + 'x'.repeat(40) + '.jpg';
    const longVehicleUrl = 'https://example.com/vehicles/' + 'x'.repeat(40) + '.jpg';

    const res = await request(app)
      .post('/api/drivers/register')
      .send({
        user_id: 'driver_reg_001',
        vehicle_type: 'taxi',
        vehicle_model: 'Toyota Corolla',
        license_plate: 'LT-123-AA',
        color: 'Jaune',
        vehicle_image: longVehicleUrl,
        avatar_url: longAvatarUrl,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.driver.vehicle_model).toBe('Toyota Corolla');
    expect(res.body.driver.license_plate).toBe('LT-123-AA');
  });

  it('should reject missing vehicle model', async () => {
    await createTestUser({ id: 'driver_reg_no_model' });

    const res = await request(app)
      .post('/api/drivers/register')
      .send({
        user_id: 'driver_reg_no_model',
        vehicle_type: 'taxi',
        vehicle_model: '',
        license_plate: 'LT-123-AA',
        color: 'Jaune',
        vehicle_image: 'https://example.com/vehicle.jpg',
        avatar_url: 'https://example.com/avatar.jpg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('modèle');
  });

  it('should reject missing vehicle photo', async () => {
    await createTestUser({ id: 'driver_reg_no_photo' });

    const res = await request(app)
      .post('/api/drivers/register')
      .send({
        user_id: 'driver_reg_no_photo',
        vehicle_type: 'taxi',
        vehicle_model: 'Toyota Corolla',
        license_plate: 'LT-123-AA',
        color: 'Jaune',
        vehicle_image: '',
        avatar_url: 'https://example.com/avatar.jpg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('photo');
  });

  it('should update existing driver on re-registration', async () => {
    await createTestDriver({ userId: 'driver_reg_update' });

    const longAvatarUrl = 'https://example.com/avatars/update/' + 'x'.repeat(30) + '.jpg';
    const longVehicleUrl = 'https://example.com/vehicles/update/' + 'x'.repeat(30) + '.jpg';

    const res = await request(app)
      .post('/api/drivers/register')
      .send({
        user_id: 'driver_reg_update',
        vehicle_type: 'moto',
        vehicle_model: 'Honda Click',
        license_plate: 'CE-999-BB',
        color: 'Noir',
        vehicle_image: longVehicleUrl,
        avatar_url: longAvatarUrl,
      });

    expect(res.status).toBe(201);
    expect(res.body.driver.vehicle_model).toBe('Honda Click');
    expect(res.body.driver.license_plate).toBe('CE-999-BB');
  });

  it('should uppercase license plate', async () => {
    await createTestUser({ id: 'driver_reg_upper' });

    const longAvatarUrl = 'https://example.com/avatars/upper/' + 'x'.repeat(30) + '.jpg';
    const longVehicleUrl = 'https://example.com/vehicles/upper/' + 'x'.repeat(30) + '.jpg';

    const res = await request(app)
      .post('/api/drivers/register')
      .send({
        user_id: 'driver_reg_upper',
        vehicle_type: 'taxi',
        vehicle_model: 'Toyota',
        license_plate: 'lt-456-cc',
        color: 'Blanc',
        vehicle_image: longVehicleUrl,
        avatar_url: longAvatarUrl,
      });

    expect(res.status).toBe(201);
    expect(res.body.driver.license_plate).toBe('LT-456-CC');
  });
});

// ─── POST /api/drivers/toggle-online ───────────────────────────────────────
describe('POST /api/drivers/toggle-online', () => {
  it('should toggle driver online status', async () => {
    const { driver } = await createTestDriver({
      userId: 'driver_toggle_001',
      isOnline: false,
    });

    const res = await request(app)
      .post('/api/drivers/toggle-online')
      .send({
        driver_id: driver.id,
        is_online: true,
        lat: 3.85,
        lng: 11.50,
      });

    expect(res.status).toBe(200);
    expect(res.body.driver.is_online).toBe(true);
    expect(parseFloat(res.body.driver.current_lat)).toBeCloseTo(3.85, 2);
  });

  it('should reject non-verified driver from going online', async () => {
    const { driver } = await createTestDriver({
      userId: 'driver_unverified',
      isOnline: false,
      verificationStatus: 'unverified',
    });

    const res = await request(app)
      .post('/api/drivers/toggle-online')
      .send({
        driver_id: driver.id,
        is_online: true,
        lat: 3.85,
        lng: 11.50,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('KYC');
  });

  it('should return 403 for unknown driver (KYC check on non-existent user)', async () => {
    const res = await request(app)
      .post('/api/drivers/toggle-online')
      .send({ driver_id: 99999, is_online: true });

    // The endpoint tries KYC check first, which returns 403 for non-existent driver
    expect([403, 404]).toContain(res.status);
  });
});

// ─── GET /api/drivers/profile/:userId ──────────────────────────────────────
describe('GET /api/drivers/profile/:userId', () => {
  it('should return driver profile with display name', async () => {
    await createTestDriver({ userId: 'driver_profile_001' });

    const res = await request(app).get('/api/drivers/profile/driver_profile_001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.driver.vehicle_model).toBeDefined();
    expect(res.body.driver.display_name).toBeDefined();
    expect(res.body.driver.public_id).toBeDefined();
  });

  it('should return 404 for unknown driver', async () => {
    const res = await request(app).get('/api/drivers/profile/driver_ghost');
    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/drivers/profile/:userId ──────────────────────────────────────
describe('PUT /api/drivers/profile/:userId', () => {
  it('should update driver profile', async () => {
    await createTestDriver({ userId: 'driver_update_001' });

    const res = await request(app)
      .put('/api/drivers/profile/driver_update_001')
      .send({
        name: 'Nouveau Nom',
        phone: '+237699888777',
        vehicle_model: 'Honda PCX',
        color: 'Rouge',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.driver.name).toBe('Nouveau Nom');
    expect(res.body.driver.vehicle_model).toBe('Honda PCX');
  });
});

// ─── GET /api/drivers/online ───────────────────────────────────────────────
describe('GET /api/drivers/online', () => {
  it('should list only online drivers', async () => {
    await createTestDriver({ userId: 'driver_online_1', isOnline: true });
    await createTestDriver({ userId: 'driver_online_2', isOnline: true });
    await createTestDriver({ userId: 'driver_offline', isOnline: false });

    const res = await request(app).get('/api/drivers/online');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.drivers).toHaveLength(2);
    // Names should be anonymized
    res.body.drivers.forEach((d: any) => {
      expect(d.name).toBeUndefined();
      expect(d.display_name).toBeDefined();
    });
  });
});

// ─── GET /api/drivers/earnings/:userId ─────────────────────────────────────
describe('GET /api/drivers/earnings/:userId', () => {
  it('should return earnings summary', async () => {
    const { driver, user } = await createTestDriver({ userId: 'driver_earnings' });

    // Create some completed rides
    for (let i = 0; i < 3; i++) {
      const rider = await createTestUser({ id: `rider_earn_${i}` });
      await createTestRide({
        riderId: rider.id,
        driverId: driver.id,
        status: 'COMPLETED',
        fare: 2000 + i * 500,
      });
    }

    const res = await request(app).get('/api/drivers/earnings/driver_earnings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.earnings.day.ridesCount).toBe(3);
    expect(res.body.earnings.day.amount).toBeGreaterThan(0);
    expect(res.body.earnings.day.avgPerRide).toBeGreaterThan(0);
  });

  it('should return zero earnings for new driver', async () => {
    await createTestUser({ id: 'driver_new_earn' });

    const res = await request(app).get('/api/drivers/earnings/driver_new_earn');

    expect(res.status).toBe(200);
    expect(res.body.earnings.day.amount).toBe(0);
  });
});
