import express, { Request, Response } from 'express';
import cors from 'cors';

import ridesRouter from './routes/rides';
import driversRouter from './routes/drivers';
import usersRouter from './routes/users';
import camerpayRouter from './routes/camerpay';
import adminRouter from './routes/admin';
import sosRouter from './routes/sos';
import disputesRouter from './routes/disputes';
import diditRouter from './routes/didit';
import locationPhotosRouter from './routes/locationPhotos';

export function createApp() {
  const app = express();
  // '*' en chaîne = autoriser toutes les origines (un tableau ['*'] est une
  // liste blanche littérale et casse le CORS pour les origines réelles)
  const allowedOrigins: string | string[] = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : '*';

  app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }));
  // Limite relevée : l'inscription chauffeur envoie la photo du véhicule en base64
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Routes REST API
  app.use('/api/rides', ridesRouter);
  app.use('/api/drivers', driversRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/camerpay', camerpayRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/sos', sosRouter);
  app.use('/api/disputes', disputesRouter);
  app.use('/api/didit', diditRouter);
  app.use('/api/location-photos', locationPhotosRouter);

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

  return app;
}
