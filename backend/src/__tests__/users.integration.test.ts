import request from 'supertest';
import { createApp } from '../app';
import { initTestDb, cleanTestDb, createTestUser, closeTestDb } from './helpers';
import { pool } from '../db';

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

// ─── POST /api/users (Create / Upsert) ──────────────────────────────────────
describe('POST /api/users', () => {
  it('should create a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        id: 'user_new_001',
        name: 'Jean Dupont',
        email: 'jean@vora.cm',
        phone: '+237699112233',
        role: 'PASSENGER',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe('user_new_001');
    expect(res.body.user.name).toBe('Jean Dupont');
    expect(res.body.user.email).toBe('jean@vora.cm');
    expect(res.body.user.display_name).toBeDefined();
    expect(res.body.user.wallet_balance).toBe(0);
  });

  it('should upsert an existing user', async () => {
    await createTestUser({ id: 'user_upsert_001', name: 'Old Name' });

    const res = await request(app)
      .post('/api/users')
      .send({
        id: 'user_upsert_001',
        name: 'New Name',
        email: 'new@vora.cm',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect(res.body.user.email).toBe('new@vora.cm');
  });

  it('should reject blocked users', async () => {
    await createTestUser({ id: 'user_blocked_001' });
    await pool.query('UPDATE users SET is_blocked = TRUE WHERE id = $1', ['user_blocked_001']);

    const res = await request(app)
      .post('/api/users')
      .send({
        id: 'user_blocked_001',
        name: 'Blocked User',
        email: 'blocked@vora.cm',
      });

    expect(res.status).toBe(403);
    expect(res.body.is_blocked).toBe(true);
  });

  it('should default role to PASSENGER', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        id: 'user_default_role',
        name: 'Default Role',
        email: 'default@vora.cm',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('PASSENGER');
  });
});

// ─── GET /api/users/:id (Get Profile) ───────────────────────────────────────
describe('GET /api/users/:id', () => {
  it('should return user profile', async () => {
    const user = await createTestUser({ id: 'user_get_001', name: 'Marie Claire' });

    const res = await request(app).get('/api/users/user_get_001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Marie Claire');
    expect(res.body.user.display_name).toBe('Marie C.');
    expect(res.body.user.wallet_balance).toBe(50000);
  });

  it('should return default profile for unknown user', async () => {
    const res = await request(app).get('/api/users/user_unknown_999');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Utilisateur VORA');
    expect(res.body.user.wallet_balance).toBe(0);
  });

  it('should return 403 for blocked user', async () => {
    await createTestUser({ id: 'user_blocked_get' });
    await pool.query('UPDATE users SET is_blocked = TRUE WHERE id = $1', ['user_blocked_get']);

    const res = await request(app).get('/api/users/user_blocked_get');

    expect(res.status).toBe(403);
    expect(res.body.is_blocked).toBe(true);
  });
});

// ─── POST /api/users/:id/topup (Wallet Top-up) ─────────────────────────────
describe('POST /api/users/:id/topup', () => {
  it('should top up wallet balance', async () => {
    await createTestUser({ id: 'user_topup_001', wallet_balance: 1000 });

    const res = await request(app)
      .post('/api/users/user_topup_001/topup')
      .send({ amount: 5000, operator: 'mtn' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.wallet_balance).toBe(6000);
    expect(res.body.amount).toBe(5000);
  });

  it('should reject invalid amount', async () => {
    await createTestUser({ id: 'user_topup_bad' });

    const res = await request(app)
      .post('/api/users/user_topup_bad/topup')
      .send({ amount: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('invalide');
  });

  it('should reject zero amount', async () => {
    await createTestUser({ id: 'user_topup_zero' });

    const res = await request(app)
      .post('/api/users/user_topup_zero/topup')
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });

  it('should create user if not exists during topup', async () => {
    const res = await request(app)
      .post('/api/users/user_new_via_topup/topup')
      .send({ amount: 2000, phone: '+237699000000' });

    expect(res.status).toBe(200);
    expect(res.body.wallet_balance).toBe(2000);
  });
});

// ─── GET /api/users/public/:id (Public Profile) ─────────────────────────────
describe('GET /api/users/public/:id', () => {
  it('should return anonymized public profile', async () => {
    await createTestUser({ id: 'user_public_001', name: 'Patrick Assako' });

    const res = await request(app).get('/api/users/public/user_public_001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.publicProfile.display_name).toBe('Patrick A.');
    expect(res.body.publicProfile.public_id).toBeDefined();
  });

  it('should return 404 for unknown user', async () => {
    const res = await request(app).get('/api/users/public/user_ghost_999');
    expect(res.status).toBe(404);
  });
});
