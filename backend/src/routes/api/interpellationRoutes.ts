import { Router } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createInterpellation,
  findInterpellationById,
  getInterpellationStats,
  listInterpellations,
} from '../../models/interpellationModel.js';

export const interpellationRoutes = Router();

const createSchema = z.object({
  reference: z.string().min(3).max(30),
  deputeId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().optional(),
  titre: z.string().min(3),
  description: z.string().nullable().optional(),
  typeInterpellation: z.string().min(1).max(40),
  dateReception: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  echeanceReponse: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

interpellationRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createInterpellation(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

interpellationRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await listInterpellations() });
  } catch (err) {
    next(err);
  }
});

interpellationRoutes.get('/stats', authJwt, async (_req, res, next) => {
  try {
    res.json(await getInterpellationStats());
  } catch (err) {
    next(err);
  }
});

interpellationRoutes.get('/:id', authJwt, async (req, res, next) => {
  try {
    const item = await findInterpellationById(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Interpellation introuvable' });
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});
