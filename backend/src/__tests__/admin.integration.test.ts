import request from 'supertest';
import { createApp } from '../app';
import { initTestDb, cleanTestDb, createTestUser, closeTestDb } from './helpers';
import { pool } from '../db';

const app = createApp();

// Use env credentials or fallback to defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vora.cm';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'VoraAdmin2025!';

beforeAll(async () => {
  await initTestDb();
});

beforeEach(async () => {
  await cleanTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

// ─── POST /api/admin/login ──────────────────────────────────────────────────
describe('POST /api/admin/login', () => {
  it('should login with valid admin credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.token.length).toBeGreaterThan(10);
    expect(res.body.email).toBe(ADMIN_EMAIL);
    expect(res.body.expiresIn).toBe('4h');
  });

  it('should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body.isAdmin).toBe(true); // Email is recognized
    expect(res.body.error).toContain('incorrect');
  });

  it('should reject unknown email', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'unknown@vora.cm', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.isAdmin).toBe(false);
  });

  it('should reject missing credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/admin/verify-token ───────────────────────────────────────────
describe('POST /api/admin/verify-token', () => {
  it('should verify a valid token', async () => {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const token = loginRes.body.token;

    const res = await request(app)
      .post('/api/admin/verify-token')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ADMIN_EMAIL);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .post('/api/admin/verify-token')
      .send({ token: 'invalid_token_123' });

    expect(res.status).toBe(401);
  });

  it('should reject missing token', async () => {
    const res = await request(app)
      .post('/api/admin/verify-token')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/accounts ───────────────────────────────────────────────
describe('GET /api/admin/accounts', () => {
  async function getAuthToken() {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return loginRes.body.token;
  }

  it('should list all users and admins with valid token', async () => {
    const token = await getAuthToken();
    await createTestUser({ id: 'user_list_001', name: 'List User' });

    const res = await request(app)
      .get('/api/admin/accounts')
      .set('x-admin-token', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users).toBeDefined();
    expect(res.body.admins).toBeDefined();
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/admin/accounts');
    expect(res.status).toBe(401);
  });

  it('should reject expired token', async () => {
    const res = await request(app)
      .get('/api/admin/accounts')
      .set('x-admin-token', 'expired_token');

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/admin/users/:id/block ───────────────────────────────────────
describe('POST /api/admin/users/:id/block', () => {
  async function getAuthToken() {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return loginRes.body.token;
  }

  it('should block a user', async () => {
    const token = await getAuthToken();
    await createTestUser({ id: 'user_to_block' });

    const res = await request(app)
      .post('/api/admin/users/user_to_block/block')
      .set('x-admin-token', token)
      .send({ block: true });

    expect(res.status).toBe(200);
    expect(res.body.user.is_blocked).toBe(true);
  });

  it('should unblock a user', async () => {
    const token = await getAuthToken();
    await createTestUser({ id: 'user_to_unblock' });
    await pool.query('UPDATE users SET is_blocked = TRUE WHERE id = $1', ['user_to_unblock']);

    const res = await request(app)
      .post('/api/admin/users/user_to_unblock/block')
      .set('x-admin-token', token)
      .send({ block: false });

    expect(res.status).toBe(200);
    expect(res.body.user.is_blocked).toBe(false);
  });

  it('should return 404 for unknown user', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .post('/api/admin/users/user_ghost/block')
      .set('x-admin-token', token)
      .send({ block: true });

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/admin/admins (Create Admin) ─────────────────────────────────
describe('POST /api/admin/admins', () => {
  async function getAuthToken() {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return loginRes.body.token;
  }

  it('should create a new admin account', async () => {
    const token = await getAuthToken();
    const uniqueEmail = `newadmin_${Date.now()}@vora.cm`;

    const res = await request(app)
      .post('/api/admin/admins')
      .set('x-admin-token', token)
      .send({
        email: uniqueEmail,
        password: 'SecurePass123!',
        name: 'New Admin',
        role: 'ADMIN',
      });

    expect(res.status).toBe(201);
    expect(res.body.admin.email).toBe(uniqueEmail);
    expect(res.body.admin.role).toBe('ADMIN');
  });

  it('should reject duplicate email', async () => {
    const token = await getAuthToken();
    const dupEmail = `dup_${Date.now()}@vora.cm`;

    await request(app)
      .post('/api/admin/admins')
      .set('x-admin-token', token)
      .send({ email: dupEmail, password: 'Pass1234!' });

    const res = await request(app)
      .post('/api/admin/admins')
      .set('x-admin-token', token)
      .send({ email: dupEmail, password: 'Pass1234!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('deja utilise');
  });

  it('should reject short password', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .post('/api/admin/admins')
      .set('x-admin-token', token)
      .send({ email: `short_${Date.now()}@vora.cm`, password: '123' });

    expect(res.status).toBe(400);
  });
});

// ─── PUT /api/admin/change-password ────────────────────────────────────────
describe('PUT /api/admin/change-password', () => {
  async function getAuthToken() {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return loginRes.body.token;
  }

  it('should change admin password with valid current password', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .put('/api/admin/change-password')
      .set('x-admin-token', token)
      .send({
        currentPassword: ADMIN_PASSWORD,
        newPassword: 'NewSecurePass456!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify new password works
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: 'NewSecurePass456!' });

    expect(loginRes.status).toBe(200);

    // Restore original password for other tests
    await request(app)
      .put('/api/admin/change-password')
      .set('x-admin-token', loginRes.body.token)
      .send({
        currentPassword: 'NewSecurePass456!',
        newPassword: ADMIN_PASSWORD,
      });
  });

  it('should reject wrong current password', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .put('/api/admin/change-password')
      .set('x-admin-token', token)
      .send({
        currentPassword: 'wrong_password',
        newPassword: 'NewPass789!',
      });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/admin/wallet ─────────────────────────────────────────────────
describe('GET /api/admin/wallet', () => {
  async function getAuthToken() {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    return loginRes.body.token;
  }

  it('should return admin wallet with commission data', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .get('/api/admin/wallet')
      .set('x-admin-token', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.wallet).toBeDefined();
    expect(res.body.wallet.commission_rate).toBeDefined();
    expect(Array.isArray(res.body.recent_commissions)).toBe(true);
  });

  it('should update commission rate', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .put('/api/admin/wallet/rate')
      .set('x-admin-token', token)
      .send({ rate: 0.15 });

    expect(res.status).toBe(200);
    expect(res.body.rate).toBe(0.15);

    // Restore default rate
    await request(app)
      .put('/api/admin/wallet/rate')
      .set('x-admin-token', token)
      .send({ rate: 0.10 });
  });

  it('should reject rate outside 0-50%', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .put('/api/admin/wallet/rate')
      .set('x-admin-token', token)
      .send({ rate: 0.6 });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/admin/logout ────────────────────────────────────────────────
describe('POST /api/admin/logout', () => {
  it('should invalidate the session token', async () => {
    const loginRes = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const token = loginRes.body.token;

    // Logout
    const logoutRes = await request(app)
      .post('/api/admin/logout')
      .send({ token });

    expect(logoutRes.status).toBe(200);

    // Verify token is no longer valid
    const verifyRes = await request(app)
      .post('/api/admin/verify-token')
      .send({ token });

    expect(verifyRes.status).toBe(401);
  });
});
