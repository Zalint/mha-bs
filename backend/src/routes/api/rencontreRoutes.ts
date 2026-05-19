import { Router } from 'express';
import { z } from 'zod';

import { createRencontreSchema } from '@mha-bs/shared';

import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createRencontre,
  findRencontreById,
  listRencontres,
} from '../../models/rencontreModel.js';

export const rencontreRoutes = Router();

const listQuerySchema = z.object({
  typeRencontre: z.string().min(1).max(50).optional(),
  annee: z.coerce.number().int().optional(),
  copilName: z.string().optional(),
});

rencontreRoutes.get('/', authJwt, validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const items = await listRencontres(req.query as z.infer<typeof listQuerySchema>);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

rencontreRoutes.get('/:id', authJwt, async (req, res, next) => {
  try {
    const item = await findRencontreById(req.params.id);
    if (!item) throw new NotFoundError('Rencontre introuvable');
    res.json(item);
  } catch (err) {
    next(err);
  }
});

rencontreRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createRencontreSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createRencontre(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);
