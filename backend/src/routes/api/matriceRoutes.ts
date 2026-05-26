import { Router } from 'express';
import { z } from 'zod';

import {
  DIRECTIVE_ETATS,
  createRecommandationMatriceSchema,
  updateRecommandationMatriceSchema,
} from '@mha-bs/shared';

import { UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createMatrice,
  getStatsByType,
  listAll,
  listByType,
  reassignMatrice,
  updateByOrder,
} from '../../models/matriceModel.js';

export const matriceRoutes = Router();

matriceRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    const items = await listAll();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

matriceRoutes.get('/stats', authJwt, async (_req, res, next) => {
  try {
    const items = await getStatsByType();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

const typeParamSchema = z.object({ typeMatrice: z.string().min(1).max(50) });

matriceRoutes.get('/:typeMatrice', authJwt, validate(typeParamSchema, 'params'), async (req, res, next) => {
  try {
    const items = await listByType(req.params.typeMatrice);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

const updateParamsSchema = z.object({
  typeMatrice: z.string().min(1).max(50),
  numOrdre: z.coerce.number().int().positive(),
});

const updateBodySchema = updateRecommandationMatriceSchema.extend({
  etat: z.enum(DIRECTIVE_ETATS).optional(),
});

matriceRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createRecommandationMatriceSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const body = req.body as z.infer<typeof createRecommandationMatriceSchema>;
      const created = await createMatrice(body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

matriceRoutes.put(
  '/:typeMatrice/:numOrdre',
  authJwt,
  requireRole('bs', 'admin'),
  validate(updateParamsSchema, 'params'),
  validate(updateBodySchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const params = req.params as unknown as z.infer<typeof updateParamsSchema>;
      const body = req.body as z.infer<typeof updateBodySchema>;
      const updated = await updateByOrder(params.typeMatrice, params.numOrdre, body, req.user.userId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

const reassignBodySchema = z.object({
  newTypeMatrice: z.string().min(1).max(50),
});

matriceRoutes.put(
  '/:typeMatrice/:numOrdre/reassign',
  authJwt,
  requireRole('bs', 'admin'),
  validate(updateParamsSchema, 'params'),
  validate(reassignBodySchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const params = req.params as unknown as z.infer<typeof updateParamsSchema>;
      const body = req.body as z.infer<typeof reassignBodySchema>;
      const updated = await reassignMatrice(
        params.typeMatrice,
        params.numOrdre,
        body.newTypeMatrice,
        req.user.userId,
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);
