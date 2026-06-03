import { Router } from 'express';
import { z } from 'zod';

import { createMissionTerrainSchema } from '@mha-bs/shared';

import { query } from '../../db/query.js';
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

const listMissionsQuerySchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100).optional(),
});

missionRoutes.get(
  '/',
  authJwt,
  validate(listMissionsQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof listMissionsQuerySchema>;
      res.json({ items: await listMissions({ annee: q.annee }) });
    } catch (err) {
      next(err);
    }
  },
);

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

// ---------------------------------------------------------------------------
// POST /api/missions/bulk-delete — suppression multiple (admin + bs)
// Body : { ids: string[] } — UUIDs des missions à supprimer
// ---------------------------------------------------------------------------

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

missionRoutes.post(
  '/bulk-delete',
  authJwt,
  requireRole('admin', 'bs'),
  validate(bulkDeleteSchema),
  async (req, res, next) => {
    try {
      const { ids } = req.body as z.infer<typeof bulkDeleteSchema>;
      // Suppression en une seule requête — la FK ouvragesVisites.missionId
      // utilise ON DELETE CASCADE, donc les ouvrages liés partent avec.
      const result = await query(
        `DELETE FROM "missionsTerrain" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (err) {
      next(err);
    }
  },
);

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
