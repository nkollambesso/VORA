-- VORA NeonDB PostgreSQL Database Schema

-- 1. Table Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY, -- Clerk ID ou Generated ID
  public_id VARCHAR(50) UNIQUE, -- Identifiant public anonymisé (ex: VORA-A8F29C)
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'PASSENGER', -- PASSENGER | DRIVER | ADMIN | SUPER_ADMIN
  verification_status VARCHAR(50) DEFAULT 'unverified', -- unverified | pending | verified | rejected
  avatar_url TEXT,
  wallet_balance INT DEFAULT 0,
  cancellation_debt INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table Chauffeurs
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) NOT NULL, -- moto | taxi | confort
  vehicle_model VARCHAR(100) NOT NULL,
  license_plate VARCHAR(50) NOT NULL,
  color VARCHAR(50) NOT NULL,
  vehicle_image TEXT, -- Photo obligatoire du véhicule pour reconnaissance client
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  rating NUMERIC(3,2) DEFAULT 5.00,
  total_rides INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table Courses
CREATE TABLE IF NOT EXISTS rides (
  id VARCHAR(100) PRIMARY KEY,
  rider_id VARCHAR(255) REFERENCES users(id),
  driver_id INT REFERENCES drivers(id),
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  dest_lat DOUBLE PRECISION NOT NULL,
  dest_lng DOUBLE PRECISION NOT NULL,
  status VARCHAR(50) DEFAULT 'SEARCHING', -- SEARCHING, ACCEPTED, PICKED_UP, IN_TRANSIT, COMPLETED, CANCELLED
  vehicle_type VARCHAR(50) NOT NULL,
  passenger_count INT DEFAULT 1,
  luggage_count INT DEFAULT 0,
  booked_for_other BOOLEAN DEFAULT FALSE,
  passenger_name VARCHAR(255),
  passenger_phone VARCHAR(50),
  fare_fcfa INT NOT NULL,
  multiplier NUMERIC(3,2) DEFAULT 1.00,
  surge_multiplier NUMERIC(3,2) DEFAULT 1.00,
  surge_reason VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'CASH', -- CASH | MTN_MOMO | ORANGE_MONEY | WALLET
  payment_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING | PAID | FAILED
  otp_code VARCHAR(6),
  rating INT,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table Repères Visuels Géolocalisés (Photos de Lieux)
CREATE TABLE IF NOT EXISTS location_photos (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  place_name VARCHAR(255) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Paramètres de la Plateforme (Super Admin Toggle Simulation)
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Valeur par défaut pour le mode simulation CamerPay (par défaut false ou true pour la démo)
INSERT INTO platform_settings (key, value, updated_by)
VALUES ('payment_simulation_mode', 'true', 'system')
ON CONFLICT (key) DO NOTHING;

-- 5. Table Alertes SOS Urgence
CREATE TABLE IF NOT EXISTS sos_alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  user_role VARCHAR(50),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE | RESOLVED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table Litiges de Courses (Mutual End-Ride Disagreements)
CREATE TABLE IF NOT EXISTS ride_disputes (
  id SERIAL PRIMARY KEY,
  ride_id VARCHAR(100) REFERENCES rides(id) ON DELETE CASCADE,
  rider_id VARCHAR(255) REFERENCES users(id),
  driver_id INT REFERENCES drivers(id),
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'A_TRAITER', -- A_TRAITER | RESOLU | REJETE
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Table des Comptes Administrateurs VORA
CREATE TABLE IF NOT EXISTS admin_accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Administrateur VORA',
  role VARCHAR(50) DEFAULT 'ADMIN', -- ADMIN | SUPER_ADMIN
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

