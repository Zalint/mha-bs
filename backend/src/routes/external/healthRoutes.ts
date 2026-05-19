import { Router } from 'express';

export const externalHealthRoutes = Router();

externalHealthRoutes.get('/ping', (_req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});
