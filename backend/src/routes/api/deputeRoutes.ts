import { Router } from 'express';
import { z } from 'zod';

import { NotFoundError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createDepute,
  deleteDepute,
  listDeputes,
  updateDepute,
} from '../../models/deputeModel.js';

export const deputeRoutes = Router();

deputeRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await listDeputes() });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  nomComplet: z.string().min(2).max(150),
  sexe: z.enum(['M', 'F']).nullable().optional(),
  groupeParlementaire: z.string().min(1).max(50),
  region: z.string().nullable().optional(),
});

deputeRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const created = await createDepute(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

const updateSchema = z.object({
  nomComplet: z.string().min(2).max(150).optional(),
  sexe: z.enum(['M', 'F']).nullable().optional(),
  groupeParlementaire: z.string().min(1).max(50).optional(),
  region: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

deputeRoutes.put(
  '/:id',
  authJwt,
  requireRole('bs', 'admin'),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateDepute(req.params.id, req.body);
      if (!updated) throw new NotFoundError('Député introuvable');
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

deputeRoutes.delete('/:id', authJwt, requireRole('admin'), async (req, res, next) => {
  try {
    const ok = await deleteDepute(req.params.id);
    if (!ok) throw new NotFoundError('Député introuvable');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
