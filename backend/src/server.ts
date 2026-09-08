import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { createApp } from './app';
import { setupSocketIO } from './socket';
import { initDatabase } from './db/init';

dotenv.config();

const app = createApp();
const server = http.createServer(app);
// '*' en chaîne = autoriser toutes les origines (voir app.ts)
const allowedOrigins: string | string[] = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : '*';

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);

// Setup Socket.io events
setupSocketIO(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`🚀 Serveur VORA prêt sur le port ${PORT}`);
  console.log(`⚡ WebSocket Socket.io écoute active`);
  await initDatabase();

  // Migration idempotente : ajout des colonnes de masquage de l'historique
  try {
    const { pool } = await import('./db/index');
    await pool.query(`
      ALTER TABLE rides
        ADD COLUMN IF NOT EXISTS hidden_by_rider BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS hidden_by_driver BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Migration rides (hidden_by_*) appliquée.');
  } catch (err) {
    console.warn('⚠️ Migration rides (hidden_by_*) ignorée (colonne probablement existante):', err);
  }
});
