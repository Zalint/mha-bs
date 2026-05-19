import { Router } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createReferentiel,
  deleteReferentiel,
  listReferentiels,
  listTypes,
  updateReferentiel,
} from '../../models/referentielModel.js';

export const referentielRoutes = Router();

const listQuerySchema = z.object({
  codeType: z.string().optional(),
  includeInactive: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

referentielRoutes.get('/', authJwt, validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const items = await listReferentiels(q.codeType, q.includeInactive);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

referentielRoutes.get('/types', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await listTypes() });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  codeType: z.string().min(1).max(50),
  code: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'code alphanumerique uniquement (lettres, chiffres, - et _)'),
  label: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  ordreAffichage: z.number().int().optional(),
});

referentielRoutes.post(
  '/',
  authJwt,
  requireRole('admin'),
  validate(createSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createReferentiel(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

const updateSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  ordreAffichage: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

referentielRoutes.put(
  '/:id',
  authJwt,
  requireRole('admin'),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      const updated = await updateReferentiel(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

referentielRoutes.delete('/:id', authJwt, requireRole('admin'), async (req, res, next) => {
  try {
    await deleteReferentiel(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
