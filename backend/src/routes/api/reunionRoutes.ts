import { Router } from 'express';
import { z } from 'zod';

import { createReunionTechniqueSchema, SOUS_SECTEURS } from '@mha-bs/shared';

import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  createReunion,
  deleteReunion,
  findReunionById,
  getReunionStatsBySousSecteur,
  listReunions,
  updateReunion,
} from '../../models/reunionModel.js';

export const reunionRoutes = Router();

const listQuerySchema = z.object({
  sousSecteur: z.enum(SOUS_SECTEURS).optional(),
});

reunionRoutes.get('/', authJwt, validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const items = await listReunions(
      req.query as z.infer<typeof listQuerySchema>,
      req.user?.userId ?? null,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

reunionRoutes.get('/stats/sous-secteur', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await getReunionStatsBySousSecteur() });
  } catch (err) {
    next(err);
  }
});

reunionRoutes.get('/:id', authJwt, async (req, res, next) => {
  try {
    const item = await findReunionById(req.params.id, req.user?.userId ?? null);
    if (!item) throw new NotFoundError('Reunion introuvable');
    res.json(item);
  } catch (err) {
    next(err);
  }
});

reunionRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createReunionTechniqueSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createReunion(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

reunionRoutes.put(
  '/:id',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createReunionTechniqueSchema.partial()),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      // Garde notesPrivees : si le body essaie de l'ecrire, on verifie d'abord
      // que l'utilisateur courant est bien le createur. Sinon -> 403 (silencieux
      // serait pire : l'UI penserait avoir sauve alors que rien n'a change).
      if ('notesPrivees' in req.body) {
        const existing = await findReunionById(req.params.id, req.user.userId);
        if (!existing) throw new NotFoundError('Reunion introuvable');
        if (existing.createdBy !== req.user.userId) {
          throw new ForbiddenError(
            'Seul le createur peut modifier les notes privees de cette reunion',
          );
        }
      }
      const updated = await updateReunion(req.params.id, req.body, req.user.userId);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

reunionRoutes.delete('/:id', authJwt, requireRole('admin', 'bs'), async (req, res, next) => {
  try {
    await deleteReunion(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
