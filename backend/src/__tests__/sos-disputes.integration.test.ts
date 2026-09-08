import request from 'supertest';
import { createApp } from '../app';
import { initTestDb, cleanTestDb, createTestUser, createTestDriver, createTestRide, closeTestDb } from './helpers';

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

// ─── POST /api/sos/trigger ─────────────────────────────────────────────────
describe('POST /api/sos/trigger', () => {
  it('should create an SOS alert', async () => {
    await createTestUser({ id: 'user_sos_001' });
    const res = await request(app)
      .post('/api/sos/trigger')
      .send({
        userId: 'user_sos_001',
        userRole: 'PASSENGER',
        lat: 3.85,
        lng: 11.50,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.alert.user_id).toBe('user_sos_001');
    expect(res.body.alert.status).toBe('ACTIVE');
  });
});

// ─── GET /api/sos/active ───────────────────────────────────────────────────
describe('GET /api/sos/active', () => {
  it('should list active SOS alerts', async () => {
    await createTestUser({ id: 'user_sos_active' });
    await request(app)
      .post('/api/sos/trigger')
      .send({ userId: 'user_sos_active', userRole: 'DRIVER', lat: 3.85, lng: 11.50 });

    const res = await request(app).get('/api/sos/active');

    expect(res.status).toBe(200);
    expect(res.body.alerts.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── POST /api/disputes ────────────────────────────────────────────────────
describe('POST /api/disputes', () => {
  it('should create a dispute for a ride', async () => {
    const user = await createTestUser({ id: 'rider_dispute' });
    const ride = await createTestRide({ riderId: user.id, status: 'COMPLETED' });

    const res = await request(app)
      .post('/api/disputes')
      .send({
        ride_id: ride.id,
        rider_id: user.id,
        reason: 'Le chauffeur a pris un itinéraire plus long',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.dispute.status).toBe('A_TRAITER');
  });

  it('should reject dispute without ride_id', async () => {
    const res = await request(app)
      .post('/api/disputes')
      .send({ reason: 'Test dispute' });

    expect(res.status).toBe(400);
  });

  it('should reject dispute without reason', async () => {
    const user = await createTestUser({ id: 'rider_no_reason' });
    const ride = await createTestRide({ riderId: user.id });

    const res = await request(app)
      .post('/api/disputes')
      .send({ ride_id: ride.id });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/disputes ─────────────────────────────────────────────────────
describe('GET /api/disputes', () => {
  it('should list all disputes', async () => {
    const user = await createTestUser({ id: 'rider_list_disp' });
    const ride = await createTestRide({ riderId: user.id, status: 'EN_LITIGE' });

    await request(app)
      .post('/api/disputes')
      .send({ ride_id: ride.id, rider_id: user.id, reason: 'Problème de paiement' });

    const res = await request(app).get('/api/disputes');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.disputes.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── POST /api/disputes/:id/status ────────────────────────────────────────
describe('POST /api/disputes/:id/status', () => {
  it('should update dispute status', async () => {
    const user = await createTestUser({ id: 'rider_disp_status' });
    const ride = await createTestRide({ riderId: user.id });

    const createRes = await request(app)
      .post('/api/disputes')
      .send({ ride_id: ride.id, rider_id: user.id, reason: 'Test update' });

    const disputeId = createRes.body.dispute.id;

    const res = await request(app)
      .post(`/api/disputes/${disputeId}/status`)
      .send({ status: 'RESOLU' });

    expect(res.status).toBe(200);
    expect(res.body.dispute.status).toBe('RESOLU');
  });
});
