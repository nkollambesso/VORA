import request from 'supertest';
import { createApp } from '../app';
import { initTestDb, cleanTestDb, createTestUser, createTestDriver, createTestRide, closeTestDb } from './helpers';
import { pool, query } from '../db';

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

// ─── POST /api/rides/estimate ───────────────────────────────────────────────
describe('POST /api/rides/estimate', () => {
  it('should return estimates for all 3 vehicle categories', async () => {
    const res = await request(app)
      .post('/api/rides/estimate')
      .send({ distance_km: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.estimates).toHaveLength(3);
    expect(res.body.estimates[0].vehicleType).toBe('moto');
    expect(res.body.estimates[1].vehicleType).toBe('taxi');
    expect(res.body.estimates[2].vehicleType).toBe('confort');
  });

  it('should include luggage fare in estimates', async () => {
    const res = await request(app)
      .post('/api/rides/estimate')
      .send({ distance_km: 5, luggage_count: 2 });

    expect(res.status).toBe(200);
    res.body.estimates.forEach((e: any) => {
      expect(e.luggageFare).toBe(600); // 2 * 300
    });
  });

  it('should default to 3.5km if no distance provided', async () => {
    const res = await request(app)
      .post('/api/rides/estimate')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.estimates).toHaveLength(3);
  });
});

// ─── POST /api/rides (Create Ride) ─────────────────────────────────────────
describe('POST /api/rides', () => {
  it('should create a new ride', async () => {
    const user = await createTestUser({ id: 'rider_create_001' });

    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: user.id,
        origin_address: 'Bastos, Yaoundé',
        destination_address: 'Mokolo, Yaoundé',
        origin_lat: 3.8833,
        origin_lng: 11.5167,
        dest_lat: 3.8667,
        dest_lng: 11.5167,
        vehicle_type: 'taxi',
        fare_fcfa: 2000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.ride.id).toMatch(/^VORA-/);
    expect(res.body.ride.status).toBe('SEARCHING');
    expect(res.body.ride.vehicle_type).toBe('taxi');
    expect(res.body.ride.fare_fcfa).toBe(2000);
    expect(res.body.ride.otp_code).toBeDefined();
  });

  it('should reject inter-city ride (Yaoundé → Douala)', async () => {
    const user = await createTestUser({ id: 'rider_intercity' });

    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: user.id,
        origin_address: 'Yaoundé',
        destination_address: 'Douala',
        origin_lat: 3.848,
        origin_lng: 11.502,
        dest_lat: 4.051,
        dest_lng: 9.767,
        vehicle_type: 'taxi',
        fare_fcfa: 5000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('interurbaine');
  });

  it('should reject moto with 2 passengers + luggage', async () => {
    const user = await createTestUser({ id: 'rider_moto_bad' });

    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: user.id,
        origin_address: 'Bastos, Yaoundé',
        destination_address: 'Mokolo, Yaoundé',
        origin_lat: 3.8833,
        origin_lng: 11.5167,
        dest_lat: 3.8667,
        dest_lng: 11.5167,
        vehicle_type: 'moto',
        passenger_count: 2,
        luggage_count: 1,
        fare_fcfa: 1500,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('seul passager');
  });

  it('should validate booked_for_other requires passenger name and phone', async () => {
    const user = await createTestUser({ id: 'rider_other' });

    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: user.id,
        origin_address: 'Bastos, Yaoundé',
        destination_address: 'Mokolo, Yaoundé',
        origin_lat: 3.8833,
        origin_lng: 11.5167,
        dest_lat: 3.8667,
        dest_lng: 11.5167,
        vehicle_type: 'taxi',
        fare_fcfa: 2000,
        booked_for_other: true,
        passenger_name: '',
        passenger_phone: 'invalid',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('nom');
  });

  it('should deduct wallet balance when paying by WALLET', async () => {
    const user = await createTestUser({ id: 'rider_wallet', wallet_balance: 10000 });

    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: user.id,
        origin_address: 'Bastos, Yaoundé',
        destination_address: 'Mokolo, Yaoundé',
        origin_lat: 3.8833,
        origin_lng: 11.5167,
        dest_lat: 3.8667,
        dest_lng: 11.5167,
        vehicle_type: 'taxi',
        fare_fcfa: 3000,
        payment_method: 'WALLET',
      });

    expect(res.status).toBe(201);
    expect(res.body.ride.payment_status).toBe('PAID');

    // Verify wallet was deducted
    const userRes = await query('SELECT wallet_balance FROM users WHERE id = $1', [user.id]);
    expect(Number(userRes.rows[0].wallet_balance)).toBe(7000);
  });

  it('should reject WALLET payment with insufficient balance', async () => {
    const user = await createTestUser({ id: 'rider_poor', wallet_balance: 500 });

    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: user.id,
        origin_address: 'Bastos, Yaoundé',
        destination_address: 'Mokolo, Yaoundé',
        origin_lat: 3.8833,
        origin_lng: 11.5167,
        dest_lat: 3.8667,
        dest_lng: 11.5167,
        vehicle_type: 'taxi',
        fare_fcfa: 3000,
        payment_method: 'WALLET',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('insuffisant');
  });

  it('should auto-create rider user if not exists', async () => {
    const res = await request(app)
      .post('/api/rides')
      .send({
        rider_id: 'auto_created_rider',
        origin_address: 'Bastos, Yaoundé',
        destination_address: 'Mokolo, Yaoundé',
        origin_lat: 3.8833,
        origin_lng: 11.5167,
        dest_lat: 3.8667,
        dest_lng: 11.5167,
        vehicle_type: 'taxi',
        fare_fcfa: 2000,
      });

    expect(res.status).toBe(201);
  });
});

// ─── GET /api/rides/:id ────────────────────────────────────────────────────
describe('GET /api/rides/:id', () => {
  it('should return ride details', async () => {
    const user = await createTestUser({ id: 'rider_get_ride' });
    const ride = await createTestRide({ riderId: user.id });

    const res = await request(app).get(`/api/rides/${ride.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ride.id).toBe(ride.id);
    expect(res.body.ride.origin_address).toBe('Bastos, Yaoundé');
  });

  it('should return 404 for unknown ride', async () => {
    const res = await request(app).get('/api/rides/VORA-UNKNOWN-999');
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/rides/user/:userId (History) ─────────────────────────────────
describe('GET /api/rides/user/:userId', () => {
  it('should return ride history for a user', async () => {
    const user = await createTestUser({ id: 'rider_history' });
    await createTestRide({ riderId: user.id, status: 'COMPLETED' });
    await createTestRide({ riderId: user.id, status: 'COMPLETED' });

    const res = await request(app).get('/api/rides/user/rider_history');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rides).toHaveLength(2);
  });

  it('should exclude hidden rides from history', async () => {
    const user = await createTestUser({ id: 'rider_hidden' });
    await createTestRide({ riderId: user.id, status: 'COMPLETED' });
    await pool.query('UPDATE rides SET hidden_by_rider = TRUE WHERE rider_id = $1', [user.id]);

    const res = await request(app).get('/api/rides/user/rider_hidden');

    expect(res.status).toBe(200);
    expect(res.body.rides).toHaveLength(0);
  });
});

// ─── DELETE /api/rides/history/user/:userId (Soft Delete) ───────────────────
describe('DELETE /api/rides/history/user/:userId', () => {
  it('should soft-delete completed rides', async () => {
    const user = await createTestUser({ id: 'rider_soft_del' });
    await createTestRide({ riderId: user.id, status: 'COMPLETED' });
    await createTestRide({ riderId: user.id, status: 'SEARCHING' }); // Active ride

    const res = await request(app).delete('/api/rides/history/user/rider_soft_del');

    expect(res.status).toBe(200);

    // Verify completed rides are hidden
    const historyRes = await request(app).get('/api/rides/user/rider_soft_del');
    expect(historyRes.body.rides).toHaveLength(1); // Only the active ride remains
  });
});

// ─── POST /api/rides/:id/cancel ────────────────────────────────────────────
describe('POST /api/rides/:id/cancel', () => {
  it('should cancel a SEARCHING ride', async () => {
    const user = await createTestUser({ id: 'rider_cancel' });
    const ride = await createTestRide({ riderId: user.id, status: 'SEARCHING' });

    const res = await request(app)
      .post(`/api/rides/${ride.id}/cancel`)
      .send({ cancelledBy: 'passenger', reason: 'Changement de计划' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify ride is cancelled
    const rideRes = await query('SELECT status FROM rides WHERE id = $1', [ride.id]);
    expect(rideRes.rows[0].status).toBe('CANCELLED');
  });

  it('should cancel an ACCEPTED ride with penalty after 2 minutes', async () => {
    const user = await createTestUser({ id: 'rider_penalty', wallet_balance: 5000 });
    const ride = await createTestRide({ riderId: user.id, status: 'ACCEPTED' });

    // Simulate the ride was accepted more than 2 minutes ago
    await pool.query('UPDATE rides SET updated_at = NOW() - INTERVAL \'3 minutes\' WHERE id = $1', [ride.id]);

    const res = await request(app)
      .post(`/api/rides/${ride.id}/cancel`)
      .send({ cancelledBy: 'passenger' });

    expect(res.status).toBe(200);
    expect(res.body.cancellationFee).toBe(500);

    // Verify wallet penalty
    const userRes = await query('SELECT wallet_balance FROM users WHERE id = $1', [user.id]);
    expect(Number(userRes.rows[0].wallet_balance)).toBe(4500);
  });

  it('should reject cancellation of IN_TRANSIT ride by passenger', async () => {
    const user = await createTestUser({ id: 'rider_no_cancel' });
    const ride = await createTestRide({ riderId: user.id, status: 'IN_TRANSIT' });

    const res = await request(app)
      .post(`/api/rides/${ride.id}/cancel`)
      .send({ cancelledBy: 'passenger' });

    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown ride', async () => {
    const res = await request(app)
      .post('/api/rides/VORA-FAKE-999/cancel')
      .send({ cancelledBy: 'passenger' });

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/rides/:id/rate ──────────────────────────────────────────────
describe('POST /api/rides/:id/rate', () => {
  it('should rate a completed ride', async () => {
    const { driver } = await createTestDriver({ userId: 'driver_rate_001' });
    const user = await createTestUser({ id: 'rider_rate' });
    const ride = await createTestRide({
      riderId: user.id,
      driverId: driver.id,
      status: 'COMPLETED',
      fare: 3000,
    });

    const res = await request(app)
      .post(`/api/rides/${ride.id}/rate`)
      .send({ rating: 5, feedback: 'Excellent trajet !', badges: ['Conduite prudente', 'Poli'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.driverRating).toBe(5);

    // Verify ride has rating
    const rideRes = await query('SELECT rating, feedback FROM rides WHERE id = $1', [ride.id]);
    expect(rideRes.rows[0].rating).toBe(5);
    expect(rideRes.rows[0].feedback).toContain('Conduite prudente');
  });

  it('should reject invalid rating (0 or 6)', async () => {
    const user = await createTestUser({ id: 'rider_bad_rate' });
    const ride = await createTestRide({ riderId: user.id, status: 'COMPLETED' });

    const res0 = await request(app)
      .post(`/api/rides/${ride.id}/rate`)
      .send({ rating: 0 });

    expect(res0.status).toBe(400);

    const res6 = await request(app)
      .post(`/api/rides/${ride.id}/rate`)
      .send({ rating: 6 });

    expect(res6.status).toBe(400);
  });

  it('should return 404 for unknown ride', async () => {
    const res = await request(app)
      .post('/api/rides/VORA-UNKNOWN-999/rate')
      .send({ rating: 5 });

    expect(res.status).toBe(404);
  });

  it('should recalculate driver average rating', async () => {
    const { driver } = await createTestDriver({ userId: 'driver_avg' });

    // Create 3 completed rides and rate them
    for (let i = 0; i < 3; i++) {
      const user = await createTestUser({ id: `rider_avg_${i}` });
      const ride = await createTestRide({
        riderId: user.id,
        driverId: driver.id,
        status: 'COMPLETED',
        fare: 2000,
      });

      await request(app)
        .post(`/api/rides/${ride.id}/rate`)
        .send({ rating: i === 0 ? 3 : 5 }); // 3, 5, 5 → avg = 4.33
    }

    const driverRes = await query('SELECT rating FROM drivers WHERE id = $1', [driver.id]);
    const avg = parseFloat(driverRes.rows[0].rating);
    expect(avg).toBeGreaterThan(4.0);
    expect(avg).toBeLessThan(5.0);
  });
});
