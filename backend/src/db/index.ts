import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_h6RFHo5MNmrk@ep-dry-sun-ax115y43-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
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
