import { Router } from 'express';

import { pingDb } from '../../db/pool.js';

export const healthRoutes = Router();

healthRoutes.get('/healthz', async (_req, res) => {
  try {
    await pingDb();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unavailable', timestamp: new Date().toISOString() });
  }
});
