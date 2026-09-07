import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const query = async (text: string, params?: any[]) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.warn('[DATABASE WARNING] Échec de requête DB (neon/postgres):', (err as any)?.message || err);
    return { rows: [], rowCount: 0 };
  }
};
