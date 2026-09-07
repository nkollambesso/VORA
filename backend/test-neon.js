const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ ERREUR: DATABASE_URL n'est pas définie dans .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function testDB() {
  try {
    console.log('Connexion en cours à Neon PostgreSQL...');
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db, current_user as user, version();');
    console.log('\n🎉 ✅ CONNEXION À NEON POSTGRESQL 100% RÉUSSIE !');
    console.log('----------------------------------------------------');
    console.log('  • Base de données      :', res.rows[0].db);
    console.log('  • Utilisateur Neon     :', res.rows[0].user);
    console.log('  • Horodatage Serveur   :', res.rows[0].current_time);
    console.log('  • Version PostgreSQL   :', res.rows[0].version.split(',')[0]);
    console.log('----------------------------------------------------\n');

    // Récupérer et lister toutes les tables existantes
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Tables dans votre Neon DB (' + tables.rows.length + ' tables) :');
    for (const t of tables.rows) {
      const count = await pool.query(`SELECT count(*) as total FROM "${t.table_name}"`);
      console.log(`  ✓ ${t.table_name.padEnd(20)} : ${count.rows[0].total} ligne(s)`);
    }

  } catch (err) {
    console.error('❌ ERREUR DE CONNEXION :', err.message);
  } finally {
    await pool.end();
  }
}

testDB();
