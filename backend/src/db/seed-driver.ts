import { pool } from './index';

async function seed() {
  console.log('Seeding driver...');
  await pool.query(`
    INSERT INTO users (id, public_id, name, email, phone, role, verification_status, avatar_url, wallet_balance)
    VALUES 
      ('user_3J0e6Cia2ik2J0ThgjtinPV8ySe', 'VORA-DRV01', 'Jean Chauffeur VORA', 'driver@vora.cm', '+237690000001', 'DRIVER', 'verified', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', 50000),
      ('driver_demo', 'VORA-DRVDEMO', 'Chauffeur Demo VORA', 'driver-demo@vora.cm', '+237690000002', 'DRIVER', 'verified', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', 50000)
    ON CONFLICT (id) DO UPDATE SET 
      role = 'DRIVER', 
      verification_status = 'verified', 
      wallet_balance = 50000, 
      name = EXCLUDED.name;
  `);

  await pool.query(`
    INSERT INTO drivers (user_id, vehicle_type, vehicle_model, license_plate, color, vehicle_image, is_online, current_lat, current_lng, rating, total_rides)
    VALUES 
      ('user_3J0e6Cia2ik2J0ThgjtinPV8ySe', 'taxi', 'Toyota Corolla Jaune', 'LT-123-AA', 'Jaune Taxi', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800', true, 3.8480, 11.5021, 4.95, 142),
      ('driver_demo', 'taxi', 'Toyota Corolla Jaune Demo', 'CE-456-BB', 'Jaune Taxi', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800', true, 3.8480, 11.5021, 4.90, 85)
    ON CONFLICT (user_id) DO UPDATE SET 
      is_online = true, 
      current_lat = 3.8480, 
      current_lng = 11.5021,
      vehicle_type = 'taxi',
      vehicle_model = EXCLUDED.vehicle_model,
      license_plate = EXCLUDED.license_plate,
      vehicle_image = EXCLUDED.vehicle_image;
  `);

  console.log('✅ Driver Jean seeded successfully in NeonDB!');
  const res = await pool.query('SELECT u.id, u.name, u.email, u.role, d.vehicle_model, d.is_online FROM users u JOIN drivers d ON u.id = d.user_id');
  console.log('DRIVERS IN DB:', res.rows);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
