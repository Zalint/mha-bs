import { Router } from 'express';

import { authJwt } from '../../middlewares/authJwt.js';
import { listDirections } from '../../models/directionModel.js';

export const directionRoutes = Router();

directionRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    const directions = await listDirections();
    res.json({ items: directions });
  } catch (err) {
    next(err);
  }
});
