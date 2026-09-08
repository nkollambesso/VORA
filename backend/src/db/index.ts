import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Recycler les connexions inactives pour éviter les coupures réseau Neon
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  max: 10,
});

// Éviter le crash du process sur une erreur de connexion inattendue (idle client)
pool.on('error', (err: Error) => {
  console.warn('[DATABASE] Erreur de connexion idle:', err.message);
});

export const query = async (text: string, params?: any[]) => {
  return await pool.query(text, params);
};

/**
 * Exécute un bloc de code dans une transaction DB.
 * En cas d'erreur, la transaction est automatiquement annulée (ROLLBACK).
 */
export async function withTransaction<T>(fn: (queryFn: typeof query) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Wrapper query qui utilise la connexion de la transaction
    const txQuery = async (text: string, params?: any[]) => {
      return await client.query(text, params);
    };
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // La connexion est peut-être déjà morte — ignorer l'échec du ROLLBACK
    }
    throw err;
  } finally {
    client.release();
  }
}
