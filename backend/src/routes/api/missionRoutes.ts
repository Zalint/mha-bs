import { Router } from 'express';
import { z } from 'zod';

import { createMissionTerrainSchema } from '@mha-bs/shared';

import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/rbac.js';
import { validate } from '../../middlewares/validate.js';
import {
  addOuvrage,
  createMission,
  deleteMission,
  deleteOuvrage,
  findMissionById,
  listMissions,
  listOuvragesByMission,
  updateMission,
} from '../../models/missionModel.js';

export const missionRoutes = Router();

missionRoutes.get('/', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await listMissions() });
  } catch (err) {
    next(err);
  }
});

missionRoutes.get('/:id', authJwt, async (req, res, next) => {
  try {
    const item = await findMissionById(req.params.id);
    if (!item) throw new NotFoundError('Mission introuvable');
    const ouvrages = await listOuvragesByMission(item.id);
    res.json({ ...item, ouvrages });
  } catch (err) {
    next(err);
  }
});

missionRoutes.post(
  '/',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createMissionTerrainSchema),
  async (req, res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const created = await createMission(req.body, req.user.userId);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  },
);

missionRoutes.put(
  '/:id',
  authJwt,
  requireRole('bs', 'admin'),
  validate(createMissionTerrainSchema.partial()),
  async (req, res, next) => {
    try {
      const updated = await updateMission(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

missionRoutes.delete('/:id', authJwt, requireRole('admin', 'bs'), async (req, res, next) => {
  try {
    await deleteMission(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const ouvrageSchema = z.object({
  nomOuvrage: z.string().min(1).max(200),
  typeOuvrage: z.string().nullable().optional(),
  etatOuvrage: z.enum(['fonctionnel', 'maintenance', 'horsService', 'enConstruction']).optional(),
  observations: z.string().nullable().optional(),
});

missionRoutes.post(
  '/:id/ouvrages',
  authJwt,
  requireRole('bs', 'admin'),
  validate(ouvrageSchema),
  async (req, res, next) => {
    try {
      const ouvrage = await addOuvrage(req.params.id, req.body);
      res.status(201).json(ouvrage);
    } catch (err) {
      next(err);
    }
  },
);

missionRoutes.delete('/ouvrages/:id', authJwt, requireRole('bs', 'admin'), async (req, res, next) => {
  try {
    await deleteOuvrage(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
