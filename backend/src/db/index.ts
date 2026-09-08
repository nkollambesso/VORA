import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
