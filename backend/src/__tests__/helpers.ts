import { pool, query } from '../db';
import { createApp } from '../app';
import express from 'express';

/**
 * Initialize the test database schema.
 * Runs the same init as the server but in the test database.
 */
export async function initTestDb(): Promise<void> {
  const fs = require('fs');
  const path = require('path');
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);

  // Ensure hidden_by_* columns exist
  await pool.query(`
    ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS hidden_by_rider BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS hidden_by_driver BOOLEAN DEFAULT FALSE;
  `).catch(() => {});
}

/**
 * Clean all test data from the database (preserves schema).
 * Deletes in order to respect foreign key constraints.
 */
export async function cleanTestDb(): Promise<void> {
  await pool.query('DELETE FROM ride_disputes');
  await pool.query('DELETE FROM support_calls');
  await pool.query('DELETE FROM sos_alerts');
  await pool.query('DELETE FROM location_photos');
  await pool.query('DELETE FROM rides');
  await pool.query('DELETE FROM drivers');
  await pool.query('DELETE FROM users WHERE id NOT LIKE $1', ['admin_%']);
  // Clean test admin accounts but keep the default one
  await pool.query("DELETE FROM admin_accounts WHERE email != 'admin@vora.cm'");
  await pool.query('DELETE FROM admin_wallet WHERE admin_email != $1', ['admin@vora.cm']);
  // Ensure the default admin wallet record exists
  await pool.query(
    `INSERT INTO admin_wallet (admin_email, total_commissions, commission_rate) VALUES ('admin@vora.cm', 0, 0.10) ON CONFLICT (admin_email) DO NOTHING`
  );
}

/**
 * Create a test user in the database.
 */
export async function createTestUser(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  verification_status: string;
  wallet_balance: number;
  avatar_url: string;
}> = {}) {
  const user = {
    id: `test_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test User',
    email: `test_${Date.now()}@vora.cm`,
    phone: `+2376${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
    role: 'PASSENGER',
    verification_status: 'verified',
    wallet_balance: 50000,
    avatar_url: 'https://example.com/avatar.jpg',
    ...overrides,
  };

  await query(
    `INSERT INTO users (id, public_id, name, email, phone, role, verification_status, wallet_balance, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET name = $3, email = $4, wallet_balance = $8`,
    [user.id, `VORA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, user.name, user.email, user.phone, user.role, user.verification_status, user.wallet_balance, user.avatar_url]
  );

  return user;
}

/**
 * Create a test driver in the database (user + driver record).
 */
export async function createTestDriver(overrides: Partial<{
  userId: string;
  vehicleType: string;
  vehicleModel: string;
  licensePlate: string;
  color: string;
  isOnline: boolean;
  lat: number;
  lng: number;
  verificationStatus: string;
}> = {}) {
  const userId = overrides.userId || `test_driver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const user = await createTestUser({
    id: userId,
    name: overrides.vehicleModel || 'Chauffeur Test',
    email: `driver_${Date.now()}@vora.cm`,
    role: 'DRIVER',
    verification_status: overrides.verificationStatus || 'verified',
  });

  const driverResult = await query(
    `INSERT INTO drivers (user_id, vehicle_type, vehicle_model, license_plate, color, is_online, current_lat, current_lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET is_online = $6, current_lat = $7, current_lng = $8
     RETURNING *`,
    [
      userId,
      overrides.vehicleType || 'taxi',
      overrides.vehicleModel || 'Toyota Corolla',
      overrides.licensePlate || `LT-${Math.floor(Math.random() * 999)}-AA`,
      overrides.color || 'Jaune',
      overrides.isOnline ?? true,
      overrides.lat || 3.848,
      overrides.lng || 11.502,
    ]
  );

  return { user, driver: driverResult.rows[0] };
}

/**
 * Create a test ride in the database.
 */
export async function createTestRide(overrides: Partial<{
  riderId: string;
  driverId: number;
  status: string;
  fare: number;
  vehicleType: string;
  originAddress: string;
  destAddress: string;
}> = {}) {
  const riderId = overrides.riderId || `test_rider_${Date.now()}`;
  const rideId = `VORA-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const result = await query(
    `INSERT INTO rides (
      id, rider_id, driver_id, origin_address, destination_address,
      origin_lat, origin_lng, dest_lat, dest_lng,
      vehicle_type, passenger_count, luggage_count,
      fare_fcfa, payment_method, payment_status, otp_code, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, 0, $11, 'CASH', 'PENDING', '123456', $12)
    RETURNING *`,
    [
      rideId,
      riderId,
      overrides.driverId || null,
      overrides.originAddress || 'Bastos, Yaoundé',
      overrides.destAddress || 'Mokolo, Yaoundé',
      3.8833, 11.5167, 3.8667, 11.5167,
      overrides.vehicleType || 'taxi',
      overrides.fare || 2000,
      overrides.status || 'SEARCHING',
    ]
  );

  return result.rows[0];
}

/**
 * Get a valid admin session token for testing.
 */
export async function getAdminToken(): Promise<string> {
  const app = createApp();
  const supertest = require('supertest');

  const res = await supertest(app)
    .post('/api/admin/login')
    .send({
      email: process.env.ADMIN_EMAIL || 'admin@vora.cm',
      password: process.env.ADMIN_PASSWORD || 'VoraAdmin2025!',
    });

  return res.body.token || '';
}

/**
 * Close the database pool (for test teardown).
 */
export async function closeTestDb(): Promise<void> {
  await pool.end();
}
