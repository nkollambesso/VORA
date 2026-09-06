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

export const query = (text: string, params?: any[]) => pool.query(text, params);
