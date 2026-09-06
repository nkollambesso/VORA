import fs from 'fs';
import path from 'path';
import { pool } from './index';

export async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚡ Verification et initialisation de la base NeonDB...');
    await pool.query(sql);
    console.log('✅ Tables NeonDB initialisées avec succès !');
  } catch (error) {
    console.error('⚠️ Erreur lors de l\'initialisation de la base NeonDB:', error);
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0));
}
