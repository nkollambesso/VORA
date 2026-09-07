import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: 'ep-dry-sun-ax115y43-pooler.c-4.us-east-2.aws.neon.tech',
  user: 'neondb_owner',
  password: 'npg_h6RFHoSMMmrk0ep',
  database: 'neondb',
  port: 5432,
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
