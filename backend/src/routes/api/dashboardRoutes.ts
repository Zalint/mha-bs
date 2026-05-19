import { Router } from 'express';
import { z } from 'zod';

import { TYPES_RENCONTRE } from '@mha-bs/shared';

import { authJwt } from '../../middlewares/authJwt.js';
import { validate } from '../../middlewares/validate.js';
import {
  getEvolutionMensuelle,
  getGlobalKpis,
  getKpisByTypeRencontre,
  getStatsByDirection,
  getStatsByType,
  getTopRetards,
} from '../../services/dashboardService.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/global', authJwt, async (_req, res, next) => {
  try {
    const [kpis, statsByType, evolution, topRetards, byDirection] = await Promise.all([
      getGlobalKpis(),
      getStatsByType(),
      getEvolutionMensuelle(),
      getTopRetards(5),
      getStatsByDirection(),
    ]);
    res.json({ kpis, statsByType, evolution, topRetards, byDirection });
  } catch (err) {
    next(err);
  }
});

const kpisQuerySchema = z.object({
  typeRencontre: z.enum(TYPES_RENCONTRE).optional(),
});

dashboardRoutes.get('/kpis', authJwt, validate(kpisQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as z.infer<typeof kpisQuerySchema>;
    const kpis = q.typeRencontre
      ? await getKpisByTypeRencontre(q.typeRencontre)
      : await getGlobalKpis();
    res.json(kpis);
  } catch (err) {
    next(err);
  }
});

dashboardRoutes.get('/par-direction', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await getStatsByDirection() });
  } catch (err) {
    next(err);
  }
});

dashboardRoutes.get('/top-retards', authJwt, async (_req, res, next) => {
  try {
    res.json({ items: await getTopRetards(10) });
  } catch (err) {
    next(err);
  }
});
