import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import ridesRouter from './routes/rides';
import driversRouter from './routes/drivers';
import usersRouter from './routes/users';
import camerpayRouter from './routes/camerpay';
import adminRouter from './routes/admin';
import sosRouter from './routes/sos';
import disputesRouter from './routes/disputes';
import diditRouter from './routes/didit';
import { setupSocketIO } from './socket';
import { initDatabase } from './db/init';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

// Routes REST API
app.use('/api/rides', ridesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/users', usersRouter);
app.use('/api/camerpay', camerpayRouter);
app.use('/api/admin', adminRouter);
app.use('/api/sos', sosRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/didit', diditRouter);

// Endpoint de santé & Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'VORA Backend API & Socket Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'VORA Backend API & Socket Server',
    timestamp: new Date().toISOString(),
  });
});

// Chrome DevTools probe handler to prevent 404 CSP warnings in browser console
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({});
});

// Setup Socket.io events
setupSocketIO(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`🚀 Serveur VORA prêt sur le port ${PORT}`);
  console.log(`⚡ WebSocket Socket.io écoute active`);
  await initDatabase();
});
